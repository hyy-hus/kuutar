import { type Options, RRule, RRuleSet, rrulestr, Weekday } from "rrule";
import type { CreateOccurrencePayload } from "#/hooks/useReservations";

/**
 * What a series repeats on. `custom` is a rule the form can't express (imported or written by
 * hand, e.g. every second week); it is carried along untouched.
 */
export type RecurrenceFreq =
	| "none"
	| "weekly"
	| "monthly"
	| "yearly"
	| "custom";

export type MonthlyMode = "day" | "nthWeekday";

export interface RRuleConfig {
	freq: RecurrenceFreq;
	/** weekly: the weekdays it happens on, numbered like Date#getDay (0 = Sunday). All seven is daily. */
	weekdays: number[];
	/** monthly: on a given day of the month, or on the nth weekday of it */
	monthlyMode: MonthlyMode;
	/** monthly, `day` mode: 1-31, or -1 for the last day of the month */
	monthDay: number;
	/** monthly, `nthWeekday` mode: 1-4, or -1 for the last one */
	nth: number;
	/** monthly, `nthWeekday` mode: the weekday, numbered like Date#getDay */
	nthWeekday: number;
	/** yearly: the month, 1-12 */
	yearMonth: number;
	/** yearly: the day of that month, 1-31 */
	yearDay: number;
	/** Last day of the series. Ignored when `count` is set. */
	until?: Date | null;
	/** Number of occurrences, before exceptions are removed */
	count?: number | null;
	/** Start times of occurrences that are excluded from the series (EXDATE) */
	exdates: Date[];
	/** Options of a `custom` rule, kept so that editing never rewrites it */
	custom?: Partial<Options>;
}

export interface ParsedRRule extends RRuleConfig {
	/** Start of the series as written in the rule, if it could be read */
	dtstart: Date | null;
}

export const NO_RECURRENCE: RRuleConfig = {
	freq: "none",
	weekdays: [],
	monthlyMode: "day",
	monthDay: 1,
	nth: 1,
	nthWeekday: 1,
	yearMonth: 1,
	yearDay: 1,
	exdates: [],
};

/** Starting values for the pattern fields, taken from the series' first day */
export function recurrenceDefaults(
	start: Date,
): Pick<
	RRuleConfig,
	| "weekdays"
	| "monthlyMode"
	| "monthDay"
	| "nth"
	| "nthWeekday"
	| "yearMonth"
	| "yearDay"
> {
	return {
		weekdays: [start.getDay()],
		monthlyMode: "day",
		monthDay: start.getDate(),
		nth: nthWeekdayOfMonth(start),
		nthWeekday: start.getDay(),
		yearMonth: start.getMonth() + 1,
		yearDay: start.getDate(),
	};
}

/*
 * rrule.js computes in UTC, so it would keep a series at the same UTC time and shift it by an
 * hour across daylight-saving changes. We hand it "floating" dates instead: the local wall-clock
 * time stored in the UTC fields. The results then come back as wall-clock times, which we turn
 * into real local Dates.
 */

/** Local wall-clock time as a floating Date for rrule.js */
const toFloating = (d: Date): Date =>
	new Date(
		Date.UTC(
			d.getFullYear(),
			d.getMonth(),
			d.getDate(),
			d.getHours(),
			d.getMinutes(),
			d.getSeconds(),
			d.getMilliseconds(),
		),
	);

/** Floating Date from rrule.js back to the same wall-clock time in local time */
const fromFloating = (d: Date): Date =>
	new Date(
		d.getUTCFullYear(),
		d.getUTCMonth(),
		d.getUTCDate(),
		d.getUTCHours(),
		d.getUTCMinutes(),
		d.getUTCSeconds(),
		d.getUTCMilliseconds(),
	);

// Indexed by Date#getDay(), which starts on Sunday unlike rrule.js
const WEEKDAYS = [
	RRule.SU,
	RRule.MO,
	RRule.TU,
	RRule.WE,
	RRule.TH,
	RRule.FR,
	RRule.SA,
];
const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

/** 1-4 for the nth such weekday of the month, -1 for the fifth (so: the last one) */
export function nthWeekdayOfMonth(d: Date): number {
	const n = Math.ceil(d.getDate() / 7);
	return n >= 5 ? -1 : n;
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const PATTERN_OPTION_KEYS = new Set([
	"freq",
	"interval",
	"byweekday",
	"bymonthday",
	"bymonth",
	"until",
	"count",
	"dtstart",
	"tzid",
	"wkst",
]);

const asArray = <T>(v: T | T[] | null | undefined): T[] =>
	v === null || v === undefined ? [] : Array.isArray(v) ? v : [v];

/** A BYDAY entry as a Date#getDay number and the optional "nth" prefix */
function readWeekday(w: unknown): { day: number; n: number | null } {
	if (w instanceof Weekday) return { day: (w.weekday + 1) % 7, n: w.n ?? null };
	if (typeof w === "number") return { day: (w + 1) % 7, n: null };
	const index = WEEKDAY_CODES.indexOf(String(w));
	return { day: (index + 1) % 7, n: null };
}

/**
 * The form fields a rule's options map to, or null when the rule says something the form can't
 * express (so it is kept as `custom`).
 */
function readPattern(
	o: Partial<Options>,
	start: Date,
): Partial<RRuleConfig> | null {
	const foreign = Object.entries(o).some(
		([key, value]) =>
			value !== undefined &&
			value !== null &&
			!PATTERN_OPTION_KEYS.has(key) &&
			!(Array.isArray(value) && value.length === 0),
	);
	if (foreign || (o.interval ?? 1) !== 1) return null;

	const by = asArray(o.byweekday).map(readWeekday);
	const monthdays = asArray(o.bymonthday);
	const months = asArray(o.bymonth);

	switch (o.freq) {
		case RRule.DAILY:
		case RRule.WEEKLY: {
			if (monthdays.length > 0 || months.length > 0) return null;
			if (by.some((w) => w.n !== null)) return null;
			const fallback = o.freq === RRule.DAILY ? ALL_DAYS : [start.getDay()];
			const days = by.length > 0 ? by.map((w) => w.day) : fallback;
			return { freq: "weekly", weekdays: [...new Set(days)].sort() };
		}
		case RRule.MONTHLY: {
			if (months.length > 0) return null;
			if (by.length === 0 && monthdays.length <= 1) {
				const monthDay = monthdays[0] ?? start.getDate();
				if (monthDay !== -1 && (monthDay < 1 || monthDay > 31)) return null;
				return { freq: "monthly", monthlyMode: "day", monthDay };
			}
			const [weekday] = by;
			if (
				by.length === 1 &&
				monthdays.length === 0 &&
				weekday.n !== null &&
				(weekday.n === -1 || (weekday.n >= 1 && weekday.n <= 4))
			) {
				return {
					freq: "monthly",
					monthlyMode: "nthWeekday",
					nth: weekday.n,
					nthWeekday: weekday.day,
				};
			}
			return null;
		}
		case RRule.YEARLY: {
			if (by.length > 0 || months.length > 1 || monthdays.length > 1) {
				return null;
			}
			const yearMonth = months[0] ?? start.getMonth() + 1;
			const yearDay = monthdays[0] ?? start.getDate();
			if (yearDay < 1 || yearDay > 31) return null;
			return { freq: "yearly", yearMonth, yearDay };
		}
		default:
			return null;
	}
}

export function parseRRule(rruleStr?: string | null): ParsedRRule {
	const none: ParsedRRule = { ...NO_RECURRENCE, dtstart: null };
	if (!rruleStr) return none;

	try {
		const set = rrulestr(rruleStr, { forceset: true }) as RRuleSet;
		const rule = set.rrules()[0];
		if (!rule) return none;

		// New rules name their time zone and hold wall-clock times in the UTC fields; legacy
		// ones hold real UTC instants
		const wallClock = Boolean(rule.options.tzid);
		const toLocal = (d: Date) => (wallClock ? fromFloating(d) : d);
		const dtstart = toLocal(rule.options.dtstart);
		const orig = rule.origOptions;

		const pattern = readPattern(orig, dtstart);
		const { dtstart: _s, tzid: _z, until: _u, count: _c, ...custom } = orig;

		return {
			...NO_RECURRENCE,
			...recurrenceDefaults(dtstart),
			...(pattern ?? { freq: "custom" as const }),
			// Rules are written with floating times; older ones with a real UTC UNTIL at the end of
			// the local day still read back as the same date
			until: orig.until ? fromFloating(orig.until) : null,
			count: orig.count ?? null,
			exdates: set.exdates().map(toLocal),
			custom: pattern ? undefined : custom,
			dtstart,
		};
	} catch {
		return none;
	}
}

/** The rrule.js options of a config's pattern, or null when there is no recurrence */
function patternOptions(
	config: RRuleConfig,
	start: Date,
): Partial<Options> | null {
	switch (config.freq) {
		case "none":
			return null;
		case "custom":
			return config.custom ?? null;
		case "weekly": {
			const days = [...new Set(config.weekdays)];
			if (days.length === 0) days.push(start.getDay());
			if (days.length === 7) return { freq: RRule.DAILY };
			return { freq: RRule.WEEKLY, byweekday: days.map((d) => WEEKDAYS[d]) };
		}
		case "monthly":
			return config.monthlyMode === "day"
				? { freq: RRule.MONTHLY, bymonthday: [config.monthDay] }
				: {
						freq: RRule.MONTHLY,
						byweekday: [WEEKDAYS[config.nthWeekday].nth(config.nth)],
					};
		case "yearly":
			return {
				freq: RRule.YEARLY,
				bymonth: [config.yearMonth],
				bymonthday: [config.yearDay],
			};
	}
}

/** The end of a series: a count if one is set, otherwise the until date (default: start day) */
function endOptions(config: RRuleConfig, start: Date): Partial<Options> {
	if (config.count) return { count: config.count };
	// Default until date to end of start date if not provided
	const untilDate = config.until ? new Date(config.until) : new Date(start);
	// Ensure UNTIL covers through the end of the selected day
	untilDate.setHours(23, 59, 59, 999);
	return { until: toFloating(untilDate) };
}

function buildSet(
	options: Partial<Options>,
	exdates: Date[],
	tzid?: string,
): RRuleSet {
	const set = new RRuleSet();
	set.rrule(new RRule({ ...options, ...(tzid ? { tzid } : {}) }));
	for (const exdate of exdates) set.exdate(toFloating(exdate));
	return set;
}

/**
 * Start times of every occurrence the pattern produces, ignoring the config's exceptions. Used to
 * list the dates the user can exclude.
 */
export function listSeriesStarts(
	startTimeStr: string,
	config: RRuleConfig,
): Date[] {
	const start = new Date(startTimeStr);
	if (Number.isNaN(start.getTime())) return [];
	const pattern = patternOptions(config, start);
	if (!pattern) return [start];
	return new RRule({
		...pattern,
		...endOptions(config, start),
		dtstart: toFloating(start),
	})
		.all()
		.map(fromFloating);
}

export function generateOccurrences(
	startTimeStr: string,
	endTimeStr: string,
	resourceId: string,
	config: RRuleConfig,
): { occurrences: CreateOccurrencePayload[]; rruleString: string | null } {
	// An empty resource id is fine: global restrictions have no resource and the caller maps it
	if (!startTimeStr || !endTimeStr) {
		return { occurrences: [], rruleString: null };
	}

	const start = new Date(startTimeStr);
	const end = new Date(endTimeStr);
	const durationMs = end.getTime() - start.getTime();

	if (
		Number.isNaN(start.getTime()) ||
		Number.isNaN(end.getTime()) ||
		durationMs <= 0
	) {
		return { occurrences: [], rruleString: null };
	}

	const pattern = patternOptions(config, start);
	if (!pattern) {
		return {
			occurrences: [
				{
					resource_id: resourceId,
					start_time: start.toISOString(),
					end_time: end.toISOString(),
				},
			],
			rruleString: null,
		};
	}

	const options = {
		...pattern,
		...endOptions(config, start),
		dtstart: toFloating(start),
	};
	const floatingDurationMs =
		toFloating(end).getTime() - toFloating(start).getTime();
	const floatingDates = buildSet(options, config.exdates).all();
	// The stored rule names the time zone whose wall clock the times follow
	const rule = buildSet(
		options,
		config.exdates,
		Intl.DateTimeFormat().resolvedOptions().timeZone,
	);

	// Each occurrence starts and ends at the same wall-clock times as the first one
	const occurrences: CreateOccurrencePayload[] = floatingDates.map((d) => ({
		resource_id: resourceId,
		start_time: fromFloating(d).toISOString(),
		end_time: fromFloating(
			new Date(d.getTime() + floatingDurationMs),
		).toISOString(),
	}));

	return {
		occurrences,
		rruleString: rule.toString(),
	};
}

/** Rewrites a stored rule with a different set of exceptions; the pattern is left as it was */
function withExdates(
	rruleStr: string,
	change: (exdates: Date[]) => Date[],
): string {
	const set = rrulestr(rruleStr, { forceset: true }) as RRuleSet;
	const rules = set.rrules();
	const wallClock = Boolean(rules[0]?.options.tzid);
	const toRule = (d: Date) => (wallClock ? toFloating(d) : d);
	const toLocal = (d: Date) => (wallClock ? fromFloating(d) : d);

	const next = new RRuleSet();
	for (const rule of rules) next.rrule(rule);
	for (const exdate of change(set.exdates().map(toLocal))) {
		next.exdate(toRule(exdate));
	}
	return next.toString();
}

/** Excludes the occurrence starting at `occurrenceStart` from a stored rule (EXDATE) */
export function addExdate(rruleStr: string, occurrenceStart: Date): string {
	return withExdates(rruleStr, (exdates) =>
		exdates.some((d) => d.getTime() === occurrenceStart.getTime())
			? exdates
			: [...exdates, occurrenceStart],
	);
}

/** Puts an excluded occurrence back into a stored rule */
export function removeExdate(rruleStr: string, occurrenceStart: Date): string {
	return withExdates(rruleStr, (exdates) =>
		exdates.filter((d) => d.getTime() !== occurrenceStart.getTime()),
	);
}
