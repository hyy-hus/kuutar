import { type Options, RRule, RRuleSet, rrulestr, Weekday } from "rrule";
import type { CreateOccurrencePayload } from "#/hooks/useReservations";

/**
 * Named recurrence patterns. Each one is relative to the start date of the series, so e.g.
 * `weekly` on a Monday start means "every Monday" and `monthlyNthWeekday` on the first Tuesday of
 * a month means "the first Tuesday of every month". `custom` is a rule we have no preset for
 * (imported or written by hand); it is carried along untouched.
 */
export type RecurrencePreset =
	| "none"
	| "daily"
	| "weekdays"
	| "weekly"
	| "monthlyDay"
	| "monthlyNthWeekday"
	| "yearlyDate"
	| "yearlyNthWeekday"
	| "yearlyNthWeekdayOfYear"
	| "custom";

export interface RRuleConfig {
	preset: RecurrencePreset;
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

export const NO_RECURRENCE: RRuleConfig = { preset: "none", exdates: [] };

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

/** 1-52 for the nth such weekday of the year, -1 for the 53rd (so: the last one) */
export function nthWeekdayOfYear(d: Date): number {
	const dayOfYear =
		Math.floor(
			(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) -
				Date.UTC(d.getFullYear(), 0, 1)) /
				86_400_000,
		) + 1;
	const n = Math.ceil(dayOfYear / 7);
	return n >= 53 ? -1 : n;
}

const PRESET_OPTIONS: Record<
	Exclude<RecurrencePreset, "none" | "custom">,
	(d: Date) => Partial<Options>
> = {
	daily: () => ({ freq: RRule.DAILY }),
	weekdays: () => ({
		freq: RRule.WEEKLY,
		byweekday: [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR],
	}),
	weekly: (d) => ({ freq: RRule.WEEKLY, byweekday: [WEEKDAYS[d.getDay()]] }),
	monthlyDay: (d) => ({ freq: RRule.MONTHLY, bymonthday: [d.getDate()] }),
	monthlyNthWeekday: (d) => ({
		freq: RRule.MONTHLY,
		byweekday: [WEEKDAYS[d.getDay()].nth(nthWeekdayOfMonth(d))],
	}),
	yearlyDate: (d) => ({
		freq: RRule.YEARLY,
		bymonth: [d.getMonth() + 1],
		bymonthday: [d.getDate()],
	}),
	yearlyNthWeekday: (d) => ({
		freq: RRule.YEARLY,
		bymonth: [d.getMonth() + 1],
		byweekday: [WEEKDAYS[d.getDay()].nth(nthWeekdayOfMonth(d))],
	}),
	yearlyNthWeekdayOfYear: (d) => ({
		freq: RRule.YEARLY,
		byweekday: [WEEKDAYS[d.getDay()].nth(nthWeekdayOfYear(d))],
	}),
};

const PRESETS = Object.keys(PRESET_OPTIONS) as Exclude<
	RecurrencePreset,
	"none" | "custom"
>[];

/** rrule.js options a rule may contain for us to recognise it as a preset */
const PRESET_OPTION_KEYS = new Set([
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

function weekdayCode(w: unknown): string {
	if (w instanceof Weekday) {
		return `${w.n ?? ""}${WEEKDAY_CODES[w.weekday]}`;
	}
	return typeof w === "number" ? WEEKDAY_CODES[w] : String(w);
}

/**
 * Canonical form of a rule's pattern, with the parts rrule.js derives from DTSTART filled in, so
 * that e.g. a legacy `FREQ=MONTHLY` equals the `monthlyDay` preset of its start date.
 */
function patternKey(o: Partial<Options>, start: Date): string {
	let byweekday = asArray(o.byweekday).map(weekdayCode);
	let bymonthday = asArray(o.bymonthday);
	let bymonth = asArray(o.bymonth);
	const noBy = byweekday.length === 0 && bymonthday.length === 0;
	if (o.freq === RRule.WEEKLY && byweekday.length === 0) {
		byweekday = [WEEKDAY_CODES[(start.getDay() + 6) % 7]];
	} else if (o.freq === RRule.MONTHLY && noBy) {
		bymonthday = [start.getDate()];
	} else if (o.freq === RRule.YEARLY && noBy && bymonth.length === 0) {
		bymonth = [start.getMonth() + 1];
		bymonthday = [start.getDate()];
	} else if (o.freq === RRule.YEARLY && noBy) {
		bymonthday = [start.getDate()];
	}
	byweekday = [...byweekday].sort();
	bymonthday = [...bymonthday].sort((a, b) => a - b);
	bymonth = [...bymonth].sort((a, b) => a - b);
	return JSON.stringify([
		o.freq,
		o.interval ?? 1,
		byweekday,
		bymonthday,
		bymonth,
	]);
}

function matchPreset(
	origOptions: Partial<Options>,
	start: Date,
): Exclude<RecurrencePreset, "none"> {
	const foreign = Object.entries(origOptions).some(
		([key, value]) =>
			value !== undefined &&
			value !== null &&
			!PRESET_OPTION_KEYS.has(key) &&
			!(Array.isArray(value) && value.length === 0),
	);
	if (!foreign) {
		const key = patternKey(origOptions, start);
		const match = PRESETS.find(
			(p) => patternKey(PRESET_OPTIONS[p](start), start) === key,
		);
		if (match) return match;
	}
	return "custom";
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

		const preset = matchPreset(orig, dtstart);
		const { dtstart: _s, tzid: _z, until: _u, count: _c, ...custom } = orig;

		return {
			preset,
			// Rules are written with floating times; older ones with a real UTC UNTIL at the end of
			// the local day still read back as the same date
			until: orig.until ? fromFloating(orig.until) : null,
			count: orig.count ?? null,
			exdates: set.exdates().map(toLocal),
			custom: preset === "custom" ? custom : undefined,
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
	if (config.preset === "none") return null;
	if (config.preset === "custom") return config.custom ?? null;
	return PRESET_OPTIONS[config.preset](start);
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
