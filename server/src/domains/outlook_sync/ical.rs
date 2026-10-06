//! Parses the `.ics` part of an Outlook meeting invite into what the importer needs.

use std::io::BufReader;
use std::str::FromStr;

use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, NaiveTime, TimeZone, Utc};
use chrono_tz::{Europe::Helsinki, Tz};
use ical::{IcalParser, property::Property};

/// Upper bound for how many occurrences one recurring invite may expand into.
const MAX_OCCURRENCES: u16 = 1000;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Method {
    Request,
    Cancel,
    Other(String),
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Person {
    /// Lowercased email address
    pub email: String,
    pub name: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ParsedInvite {
    pub method: Method,
    pub uid: String,
    pub sequence: i32,
    pub summary: String,
    pub description: Option<String>,
    pub location: Option<String>,
    pub organizer: Option<Person>,
    pub attendees: Vec<Person>,
    pub start: DateTime<Tz>,
    pub duration: Duration,
    pub rrule: Option<String>,
    pub exdates: Vec<DateTime<Tz>>,
    /// Set on a single-occurrence override of a series (not supported yet)
    pub is_override: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum IcalError {
    #[error("no calendar in the attachment: {0}")]
    Parse(String),
    #[error("the calendar contains no event")]
    NoEvent,
    #[error("the event is missing {0}")]
    Missing(&'static str),
    #[error("invalid date or time: {0}")]
    BadTime(String),
}

impl ParsedInvite {
    /// All occurrences as UTC ranges, expanding the recurrence rule up to `horizon`.
    pub fn occurrences(&self, horizon: DateTime<Utc>) -> Vec<(DateTime<Utc>, DateTime<Utc>)> {
        let to_range = |s: DateTime<Utc>| (s, s + self.duration);

        let Some(rrule) = &self.rrule else {
            return vec![to_range(self.start.with_timezone(&Utc))];
        };

        let mut spec = format!("{}\nRRULE:{rrule}", dt_line("DTSTART", &self.start));
        for ex in &self.exdates {
            spec.push('\n');
            spec.push_str(&dt_line("EXDATE", ex));
        }

        match rrule::RRuleSet::from_str(&spec) {
            Ok(set) => {
                let horizon = horizon.with_timezone(&rrule::Tz::UTC);
                set.before(horizon)
                    .all(MAX_OCCURRENCES)
                    .dates
                    .into_iter()
                    .map(|d| to_range(d.with_timezone(&Utc)))
                    .collect()
            }
            Err(err) => {
                tracing::warn!("Unusable RRULE '{rrule}' on invite {}: {err}", self.uid);
                vec![to_range(self.start.with_timezone(&Utc))]
            }
        }
    }
}

/// `DTSTART;TZID=Europe/Helsinki:20260101T090000`, or the `Z` form for UTC.
fn dt_line(name: &str, dt: &DateTime<Tz>) -> String {
    if dt.timezone() == Tz::UTC {
        format!("{name}:{}", dt.format("%Y%m%dT%H%M%SZ"))
    } else {
        format!(
            "{name};TZID={}:{}",
            dt.timezone().name(),
            dt.format("%Y%m%dT%H%M%S")
        )
    }
}

pub fn parse_invite(ics: &str) -> Result<ParsedInvite, IcalError> {
    let calendar = IcalParser::new(BufReader::new(ics.as_bytes()))
        .next()
        .ok_or_else(|| IcalError::Parse("empty".to_string()))?
        .map_err(|e| IcalError::Parse(e.to_string()))?;

    let event = calendar.events.first().ok_or(IcalError::NoEvent)?;
    let props = &event.properties;

    let method = match find(&calendar.properties, "METHOD")
        .and_then(|p| p.value.as_deref())
        .map(|m| m.trim().to_ascii_uppercase())
        .as_deref()
    {
        Some("REQUEST") | None => Method::Request,
        Some("CANCEL") => Method::Cancel,
        Some(other) => Method::Other(other.to_string()),
    };

    let uid = value(props, "UID").ok_or(IcalError::Missing("UID"))?;

    let dtstart = find(props, "DTSTART").ok_or(IcalError::Missing("DTSTART"))?;
    let (start, all_day) = parse_time(dtstart)?;

    let duration = if let Some(dtend) = find(props, "DTEND") {
        let (end, _) = parse_time(dtend)?;
        end.with_timezone(&Utc) - start.with_timezone(&Utc)
    } else if all_day {
        Duration::days(1)
    } else {
        Duration::zero()
    };
    if duration <= Duration::zero() {
        return Err(IcalError::BadTime("the event ends before it starts".into()));
    }

    let exdates = props
        .iter()
        .filter(|p| p.name.eq_ignore_ascii_case("EXDATE"))
        .map(|p| parse_time_list(p))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .collect();

    Ok(ParsedInvite {
        method,
        uid,
        sequence: value(props, "SEQUENCE")
            .and_then(|s| s.parse().ok())
            .unwrap_or(0),
        summary: value(props, "SUMMARY").unwrap_or_default(),
        description: value(props, "DESCRIPTION").filter(|d| !d.trim().is_empty()),
        location: value(props, "LOCATION").filter(|l| !l.trim().is_empty()),
        organizer: find(props, "ORGANIZER").and_then(person),
        attendees: props
            .iter()
            .filter(|p| p.name.eq_ignore_ascii_case("ATTENDEE"))
            .filter_map(person)
            .collect(),
        start,
        duration,
        rrule: value(props, "RRULE"),
        exdates,
        is_override: find(props, "RECURRENCE-ID").is_some(),
    })
}

fn find<'a>(props: &'a [Property], name: &str) -> Option<&'a Property> {
    props.iter().find(|p| p.name.eq_ignore_ascii_case(name))
}

fn value(props: &[Property], name: &str) -> Option<String> {
    find(props, name)
        .and_then(|p| p.value.as_deref())
        .map(unescape_text)
}

fn param<'a>(prop: &'a Property, name: &str) -> Option<&'a str> {
    prop.params
        .as_ref()?
        .iter()
        .find(|(n, _)| n.eq_ignore_ascii_case(name))
        .and_then(|(_, v)| v.first())
        .map(String::as_str)
}

/// TEXT values escape `\n`, `\,`, `\;` and `\\`.
fn unescape_text(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    let mut chars = s.chars();
    while let Some(c) = chars.next() {
        if c != '\\' {
            out.push(c);
            continue;
        }
        match chars.next() {
            Some('n' | 'N') => out.push('\n'),
            Some(other) => out.push(other),
            None => out.push('\\'),
        }
    }
    out
}

fn person(prop: &Property) -> Option<Person> {
    let raw = prop.value.as_deref()?.trim();
    let email = raw
        .get(..7)
        .filter(|p| p.eq_ignore_ascii_case("mailto:"))
        .map_or(raw, |_| &raw[7..])
        .trim()
        .to_lowercase();
    if !email.contains('@') {
        return None;
    }
    Some(Person {
        email,
        name: param(prop, "CN").map(|n| n.trim_matches('"').to_string()),
    })
}

fn parse_time_list(prop: &Property) -> Result<Vec<DateTime<Tz>>, IcalError> {
    let value = prop.value.as_deref().unwrap_or_default();
    value
        .split(',')
        .filter(|v| !v.trim().is_empty())
        .map(|v| {
            let single = Property {
                name: prop.name.clone(),
                params: prop.params.clone(),
                value: Some(v.trim().to_string()),
            };
            parse_time(&single).map(|(dt, _)| dt)
        })
        .collect()
}

/// Returns the time in its own zone, and whether it was a date-only (all-day) value.
fn parse_time(prop: &Property) -> Result<(DateTime<Tz>, bool), IcalError> {
    let raw = prop.value.as_deref().unwrap_or_default().trim();
    let bad = || IcalError::BadTime(raw.to_string());

    let is_date = param(prop, "VALUE").is_some_and(|v| v.eq_ignore_ascii_case("DATE"))
        || (raw.len() == 8 && !raw.contains('T'));
    if is_date {
        let date = NaiveDate::parse_from_str(raw, "%Y%m%d").map_err(|_| bad())?;
        let local = NaiveDateTime::new(date, NaiveTime::MIN);
        return Ok((resolve_local(Helsinki, local).ok_or_else(bad)?, true));
    }

    if let Some(utc) = raw.strip_suffix('Z') {
        let naive = NaiveDateTime::parse_from_str(utc, "%Y%m%dT%H%M%S").map_err(|_| bad())?;
        return Ok((Tz::UTC.from_utc_datetime(&naive), false));
    }

    let naive = NaiveDateTime::parse_from_str(raw, "%Y%m%dT%H%M%S").map_err(|_| bad())?;
    let tz = param(prop, "TZID").map_or(Helsinki, resolve_tz);
    Ok((resolve_local(tz, naive).ok_or_else(bad)?, false))
}

/// Local wall-clock time in `tz`; the earlier instant if it is ambiguous (DST end).
fn resolve_local(tz: Tz, local: NaiveDateTime) -> Option<DateTime<Tz>> {
    tz.from_local_datetime(&local).earliest().or_else(|| {
        // Falls in a DST gap: shift forward by the gap
        tz.from_local_datetime(&(local + Duration::hours(1)))
            .earliest()
    })
}

/// Maps an IANA or Windows time zone name to a zone. Unknown zones fall back to Helsinki,
/// the zone of every resource this app handles.
fn resolve_tz(name: &str) -> Tz {
    let name = name.trim().trim_matches('"');
    if let Ok(tz) = name.parse::<Tz>() {
        return tz;
    }
    windows_to_iana(name).unwrap_or_else(|| {
        tracing::warn!("Unknown time zone '{name}', assuming Europe/Helsinki");
        Helsinki
    })
}

fn windows_to_iana(name: &str) -> Option<Tz> {
    use chrono_tz::{Asia, Atlantic, Europe, US};
    Some(match name {
        "UTC" | "GMT Standard Time UTC" | "Coordinated Universal Time" => Tz::UTC,
        "FLE Standard Time" => Europe::Helsinki,
        "GTB Standard Time" => Europe::Bucharest,
        "E. Europe Standard Time" => Europe::Chisinau,
        "W. Europe Standard Time" => Europe::Berlin,
        "Central Europe Standard Time" => Europe::Budapest,
        "Central European Standard Time" => Europe::Warsaw,
        "Romance Standard Time" => Europe::Paris,
        "GMT Standard Time" => Europe::London,
        "Greenwich Standard Time" => Atlantic::Reykjavik,
        "Russian Standard Time" => Europe::Moscow,
        "Turkey Standard Time" => Europe::Istanbul,
        "Eastern Standard Time" => US::Eastern,
        "Central Standard Time" => US::Central,
        "Pacific Standard Time" => US::Pacific,
        "Tokyo Standard Time" => Asia::Tokyo,
        "China Standard Time" => Asia::Shanghai,
        "India Standard Time" => Asia::Kolkata,
        _ => return None,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn invite(body: &str) -> String {
        format!(
            "BEGIN:VCALENDAR\r\nMETHOD:REQUEST\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\n{body}END:VEVENT\r\nEND:VCALENDAR\r\n"
        )
    }

    #[test]
    fn parses_single_event_with_windows_zone() {
        let ics = invite(
            "UID:abc-1\r\nSEQUENCE:2\r\nSUMMARY:Kokous\\, tärkeä\r\n\
             DTSTART;TZID=FLE Standard Time:20260115T100000\r\n\
             DTEND;TZID=FLE Standard Time:20260115T113000\r\n\
             ORGANIZER;CN=Matti Meikäläinen:mailto:Matti@Example.com\r\n\
             ATTENDEE;CN=Sauna;CUTYPE=RESOURCE:mailto:sauna@hyy.fi\r\n",
        );
        let inv = parse_invite(&ics).unwrap();

        assert_eq!(inv.method, Method::Request);
        assert_eq!(inv.uid, "abc-1");
        assert_eq!(inv.sequence, 2);
        assert_eq!(inv.summary, "Kokous, tärkeä");
        assert_eq!(inv.organizer.as_ref().unwrap().email, "matti@example.com");
        assert_eq!(inv.attendees[0].email, "sauna@hyy.fi");

        // 10:00 Helsinki in January is 08:00 UTC
        let occ = inv.occurrences(Utc::now() + Duration::days(3650));
        assert_eq!(occ.len(), 1);
        assert_eq!(occ[0].0.to_rfc3339(), "2026-01-15T08:00:00+00:00");
        assert_eq!(occ[0].1.to_rfc3339(), "2026-01-15T09:30:00+00:00");
    }

    #[test]
    fn utc_times_and_cancel_method() {
        let ics = invite("UID:abc-2\r\nDTSTART:20260601T060000Z\r\nDTEND:20260601T070000Z\r\n")
            .replace("REQUEST", "CANCEL");
        let inv = parse_invite(&ics).unwrap();
        assert_eq!(inv.method, Method::Cancel);
        assert_eq!(
            inv.start.with_timezone(&Utc).to_rfc3339(),
            "2026-06-01T06:00:00+00:00"
        );
    }

    #[test]
    fn weekly_series_keeps_wall_clock_time_across_dst() {
        // Europe/Helsinki switches to summer time on 2026-03-29
        let ics = invite(
            "UID:abc-3\r\nDTSTART;TZID=FLE Standard Time:20260320T100000\r\n\
             DTEND;TZID=FLE Standard Time:20260320T110000\r\n\
             RRULE:FREQ=WEEKLY;COUNT=3\r\n",
        );
        let inv = parse_invite(&ics).unwrap();
        let occ = inv.occurrences(Utc::now() + Duration::days(3650));
        let starts: Vec<_> = occ.iter().map(|o| o.0.to_rfc3339()).collect();
        assert_eq!(
            starts,
            [
                "2026-03-20T08:00:00+00:00",
                "2026-03-27T08:00:00+00:00",
                "2026-04-03T07:00:00+00:00",
            ]
        );
    }

    #[test]
    fn exdate_removes_an_occurrence_and_horizon_caps_endless_series() {
        let ics = invite(
            "UID:abc-4\r\nDTSTART:20260105T080000Z\r\nDTEND:20260105T090000Z\r\n\
             RRULE:FREQ=DAILY;COUNT=5\r\nEXDATE:20260107T080000Z\r\n",
        );
        let inv = parse_invite(&ics).unwrap();
        assert_eq!(inv.occurrences(Utc::now() + Duration::days(3650)).len(), 4);

        let endless = invite(
            "UID:abc-5\r\nDTSTART:20260105T080000Z\r\nDTEND:20260105T090000Z\r\nRRULE:FREQ=DAILY\r\n",
        );
        let inv = parse_invite(&endless).unwrap();
        let horizon = Utc.with_ymd_and_hms(2026, 1, 15, 0, 0, 0).unwrap();
        assert_eq!(inv.occurrences(horizon).len(), 10);
    }

    #[test]
    fn all_day_event_spans_the_day() {
        let ics =
            invite("UID:abc-6\r\nDTSTART;VALUE=DATE:20260301\r\nDTEND;VALUE=DATE:20260302\r\n");
        let inv = parse_invite(&ics).unwrap();
        assert_eq!(inv.duration, Duration::hours(24));
    }

    #[test]
    fn rejects_garbage_and_incomplete_events() {
        assert!(parse_invite("not a calendar").is_err());
        assert!(matches!(
            parse_invite(&invite("SUMMARY:x\r\n")),
            Err(IcalError::Missing("UID"))
        ));
    }
}
