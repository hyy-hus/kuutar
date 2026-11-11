/** Monday first; the numbers are what Date#getDay returns */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface WeekdayRun {
	from: number;
	to: number;
}

/**
 * Groups weekdays (numbered like Date#getDay) into runs of consecutive days, Monday first:
 * Monday to Sunday is one run, Monday to Friday plus Sunday is two. Used for "ma–pe, su".
 */
export function weekdayRuns(days: number[]): WeekdayRun[] {
	const selected = new Set(days);
	const runs: WeekdayRun[] = [];
	let current: WeekdayRun | null = null;
	for (const day of WEEK_ORDER) {
		if (selected.has(day)) {
			if (current) current.to = day;
			else {
				current = { from: day, to: day };
				runs.push(current);
			}
		} else {
			current = null;
		}
	}
	return runs;
}
