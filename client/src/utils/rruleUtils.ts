import { type Frequency, RRule, rrulestr } from "rrule";
import type { CreateOccurrencePayload } from "#/hooks/useReservations";

export interface RRuleConfig {
	freq: Frequency | null;
	until?: Date | null;
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

export function parseRRule(rruleStr?: string | null): RRuleConfig {
	if (!rruleStr) return { freq: null, until: null };

	try {
		const rule = rrulestr(rruleStr) as RRule;
		return {
			freq: rule.options.freq ?? null,
			// Rules are written with floating times; older ones with a real UTC UNTIL at the end of
			// the local day still read back as the same date
			until: rule.options.until ? fromFloating(rule.options.until) : null,
		};
	} catch {
		return { freq: null, until: null };
	}
}

export function generateOccurrences(
	startTimeStr: string,
	endTimeStr: string,
	resourceId: string,
	config: RRuleConfig,
): { occurrences: CreateOccurrencePayload[]; rruleString: string | null } {
	if (!startTimeStr || !endTimeStr || !resourceId) {
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

	if (config.freq === null) {
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

	// Default until date to end of start date if not provided
	const untilDate = config.until ? new Date(config.until) : new Date(start);
	// Ensure UNTIL covers through the end of the selected day
	untilDate.setHours(23, 59, 59, 999);

	const options = {
		freq: config.freq,
		dtstart: toFloating(start),
		until: toFloating(untilDate),
	};
	const floatingDurationMs =
		toFloating(end).getTime() - toFloating(start).getTime();
	const floatingDates = new RRule(options).all();
	// The stored rule names the time zone whose wall clock the times follow
	const rule = new RRule({
		...options,
		tzid: Intl.DateTimeFormat().resolvedOptions().timeZone,
	});

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
