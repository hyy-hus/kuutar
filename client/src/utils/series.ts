import { addExdate, parseRRule } from "./rruleUtils";

interface SeriesOccurrence {
	id: string;
	start_time: string;
	end_time: string;
}

/** Occurrences that happen at the same time as `occurrence`, e.g. one per reserved resource */
export function occurrencesAtSameTime<T extends SeriesOccurrence>(
	occurrences: T[],
	occurrence: SeriesOccurrence,
): T[] {
	return occurrences.filter(
		(o) =>
			new Date(o.start_time).getTime() ===
				new Date(occurrence.start_time).getTime() &&
			new Date(o.end_time).getTime() ===
				new Date(occurrence.end_time).getTime(),
	);
}

/**
 * Whether `occurrence` can be split off: it is in a recurring series with other times in it. A
 * time on several resources has several rows, and only the first of them is offered.
 */
export function canSplitOccurrence(
	rrule: string | null | undefined,
	occurrences: SeriesOccurrence[],
	occurrence: SeriesOccurrence,
): boolean {
	if (!rrule) return false;
	const sameTime = occurrencesAtSameTime(occurrences, occurrence);
	return (
		sameTime.length < occurrences.length && sameTime[0].id === occurrence.id
	);
}

/**
 * What to send to a split endpoint to detach `occurrence` from its series: the ids of every row
 * at that time and the original's rule with that time excluded, so that editing the original
 * later doesn't bring the occurrence back.
 */
export function planSplit(
	rrule: string,
	occurrences: SeriesOccurrence[],
	occurrence: SeriesOccurrence,
): { occurrence_ids: string[]; rrule: string } {
	const occurrence_ids = occurrencesAtSameTime(occurrences, occurrence).map(
		(o) => o.id,
	);
	let remainingRule = rrule;
	try {
		remainingRule = addExdate(rrule, new Date(occurrence.start_time));
	} catch {
		// A rule we can't read stays as it was; the occurrences are what count server-side
	}
	return { occurrence_ids, rrule: remainingRule };
}

/**
 * Start and end of the series' first occurrence, for an edit form. The rule remembers where the
 * series began even when that occurrence has been excluded, and the form must regenerate from
 * there; otherwise the exclusion would move the series start and shift e.g. its COUNT.
 */
export function seriesFirstTimes(
	rrule: string | null | undefined,
	firstOccurrence: Pick<SeriesOccurrence, "start_time" | "end_time">,
): { start: Date; end: Date } {
	const start = new Date(firstOccurrence.start_time);
	const end = new Date(firstOccurrence.end_time);
	const dtstart = parseRRule(rrule).dtstart;
	if (!dtstart || dtstart.getTime() === start.getTime()) return { start, end };
	return {
		start: dtstart,
		end: new Date(dtstart.getTime() + (end.getTime() - start.getTime())),
	};
}
