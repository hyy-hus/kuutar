//! Sends reservation notification emails from the stored templates.

use chrono::{DateTime, Datelike, Utc, Weekday};
use chrono_tz::Europe::Helsinki;
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    db,
    models::EmailTemplateKey,
    render::{self, Variables},
};
use crate::{
    config::Config,
    domains::reservations::{
        db as reservations_db,
        models::{Occurrence, ReservationStatus, ReservationWithOccurrences},
    },
    errors::AppError,
    utils::{lang::normalize_language, mail},
};

/// Queues a notification for a reservation without delaying or failing the request.
pub fn spawn_reservation_email(
    pool: &PgPool,
    config: &Config,
    key: EmailTemplateKey,
    reservation_id: Uuid,
) {
    if config.smtp_host.is_none() {
        tracing::debug!("SMTP_HOST not set, skipping {} email", key.as_str());
        return;
    }

    let (pool, config) = (pool.clone(), config.clone());
    tokio::spawn(async move {
        if let Err(err) = send_reservation_email(&pool, &config, key, reservation_id).await {
            tracing::error!(
                "Failed to send {} email for reservation {reservation_id}: {err}",
                key.as_str()
            );
        }
    });
}

async fn send_reservation_email(
    pool: &PgPool,
    config: &Config,
    key: EmailTemplateKey,
    reservation_id: Uuid,
) -> Result<(), AppError> {
    let reservation = reservations_db::find_by_id(pool, reservation_id, true).await?;

    let recipient = sqlx::query!(
        r#"SELECT name, email, language FROM users WHERE id = $1 AND deleted_at IS NULL"#,
        reservation.reservation.user_id
    )
    .fetch_optional(pool)
    .await?
    .ok_or(AppError::NotFound)?;

    let lang = normalize_language(&recipient.language);
    let template = db::get(pool, key).await?;
    let (subject, body) = db::pick_language(&template, lang)
        .ok_or_else(|| AppError::InternalServerError("Email template is empty".to_string()))?;

    let vars = reservation_variables(pool, config, &reservation, &recipient.name, lang).await?;
    let rendered = render::render(&body, &vars);

    // The account holder always gets the mail; the contact person is copied in.
    let cc = reservation
        .reservation
        .contact_email
        .as_deref()
        .map(str::trim)
        .filter(|cc| !cc.is_empty() && !cc.eq_ignore_ascii_case(&recipient.email));

    mail::send_email(
        config,
        &recipient.email,
        cc,
        &render::substitute(&subject, &vars),
        rendered.html,
        rendered.text,
    )
    .await
}

async fn reservation_variables(
    pool: &PgPool,
    config: &Config,
    reservation: &ReservationWithOccurrences,
    user_name: &str,
    lang: &str,
) -> Result<Variables, AppError> {
    let resource_ids: Vec<Uuid> = reservation
        .occurrences
        .iter()
        .map(|occurrence| occurrence.resource_id)
        .collect();
    let resources = sqlx::query!(
        r#"SELECT id, name FROM resources WHERE id = ANY($1)"#,
        &resource_ids
    )
    .fetch_all(pool)
    .await?;

    let occurrences = reservation
        .occurrences
        .iter()
        .map(|occurrence| {
            let resource = resources
                .iter()
                .find(|resource| resource.id == occurrence.resource_id)
                .map(|resource| resource.name.as_str())
                .unwrap_or_default();
            format_occurrence(occurrence, resource, lang)
        })
        .collect::<Vec<_>>()
        .join("\n");

    let base = config.app_base_url.trim_end_matches('/');

    Ok(Variables::from([
        ("user_name", user_name.to_string()),
        ("title", reservation.reservation.title.clone()),
        (
            "status",
            status_label(reservation.reservation.status, lang).to_string(),
        ),
        (
            "contact_person",
            reservation
                .reservation
                .contact_person
                .clone()
                .unwrap_or_default(),
        ),
        ("occurrences", occurrences),
        (
            "reservation_url",
            format!("{base}/reservations/{}", reservation.reservation.id),
        ),
    ]))
}

/// Example values for previews and test sends.
pub fn sample_variables(config: &Config, lang: &str) -> Variables {
    let start = Utc::now() + chrono::Duration::days(7);
    let occurrence = Occurrence {
        id: Uuid::nil(),
        reservation_id: Uuid::nil(),
        resource_id: Uuid::nil(),
        start_time: start,
        end_time: start + chrono::Duration::hours(2),
        created_at: start,
    };
    let base = config.app_base_url.trim_end_matches('/');

    Variables::from([
        ("user_name", "Matti Meikäläinen".to_string()),
        ("title", "Kokous".to_string()),
        (
            "status",
            status_label(ReservationStatus::Confirmed, lang).to_string(),
        ),
        ("contact_person", "Maija Meikäläinen".to_string()),
        (
            "occurrences",
            format_occurrence(&occurrence, "Kerhohuone", lang),
        ),
        (
            "reservation_url",
            format!("{base}/reservations/00000000-0000-0000-0000-000000000000"),
        ),
    ])
}

fn status_label(status: ReservationStatus, lang: &str) -> &'static str {
    match (lang, status) {
        ("sv", ReservationStatus::Pending) => "Väntar på godkännande",
        ("sv", ReservationStatus::Confirmed) => "Bekräftad",
        ("sv", ReservationStatus::Cancelled) => "Avbokad",
        ("en", ReservationStatus::Pending) => "Pending",
        ("en", ReservationStatus::Confirmed) => "Confirmed",
        ("en", ReservationStatus::Cancelled) => "Cancelled",
        (_, ReservationStatus::Pending) => "Odottaa hyväksyntää",
        (_, ReservationStatus::Confirmed) => "Vahvistettu",
        (_, ReservationStatus::Cancelled) => "Peruttu",
    }
}

fn weekday_label(weekday: Weekday, lang: &str) -> &'static str {
    let names = match lang {
        "sv" => ["mån", "tis", "ons", "tors", "fre", "lör", "sön"],
        "en" => ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        _ => ["ma", "ti", "ke", "to", "pe", "la", "su"],
    };
    names[weekday.num_days_from_monday() as usize]
}

fn format_moment(moment: DateTime<Utc>, lang: &str) -> (String, String) {
    let local = moment.with_timezone(&Helsinki);
    (
        format!(
            "{} {}.{}.{}",
            weekday_label(local.weekday(), lang),
            local.day(),
            local.month(),
            local.year()
        ),
        local.format("%H:%M").to_string(),
    )
}

/// e.g. `ma 5.10.2026 12:00–14:00, Kerhohuone` (times in Finnish local time).
fn format_occurrence(occurrence: &Occurrence, resource: &str, lang: &str) -> String {
    let (start_date, start_time) = format_moment(occurrence.start_time, lang);
    let (end_date, end_time) = format_moment(occurrence.end_time, lang);

    let when = if start_date == end_date {
        format!("{start_date} {start_time}–{end_time}")
    } else {
        format!("{start_date} {start_time} – {end_date} {end_time}")
    };

    if resource.is_empty() {
        when
    } else {
        format!("{when}, {resource}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_format_occurrence_uses_finnish_local_time() {
        let occurrence = Occurrence {
            id: Uuid::nil(),
            reservation_id: Uuid::nil(),
            resource_id: Uuid::nil(),
            // 09:00 UTC is 12:00 in Helsinki during summer time
            start_time: Utc.with_ymd_and_hms(2026, 10, 5, 9, 0, 0).unwrap(),
            end_time: Utc.with_ymd_and_hms(2026, 10, 5, 11, 0, 0).unwrap(),
            created_at: Utc::now(),
        };
        assert_eq!(
            format_occurrence(&occurrence, "Kerhohuone", "fi"),
            "ma 5.10.2026 12:00–14:00, Kerhohuone"
        );
        assert_eq!(
            format_occurrence(&occurrence, "", "en"),
            "Mon 5.10.2026 12:00–14:00"
        );
    }
}
