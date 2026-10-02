import { formatYYYYMMDD, parseLocalDate } from "#/utils/date";

/** Selectable reservation list periods, in months */
export const PERIOD_MONTHS = [1, 3, 6, 12] as const;

export type PeriodMonths = (typeof PERIOD_MONTHS)[number];

/** Reads a `months` search param, ignoring anything that is not a supported period */
export const parsePeriodMonths = (value: unknown): PeriodMonths | undefined =>
	PERIOD_MONTHS.find((months) => months === value);

/** Snaps a date to the start of its month, or to the start of its year for 12-month periods */
export const startOfPeriod = (d: Date, months: PeriodMonths): Date =>
	new Date(d.getFullYear(), months === 12 ? 0 : d.getMonth(), 1);

/** Resolves the calendar-aligned period containing `startDate` (default: today) */
export function getPeriodRange(
	startDate: string | undefined,
	months: PeriodMonths,
) {
	const start = startOfPeriod(
		startDate ? parseLocalDate(startDate) : new Date(),
		months,
	);
	// End is the last millisecond before the next period starts
	const end = new Date(start);
	end.setMonth(end.getMonth() + months);
	end.setMilliseconds(-1);

	return {
		start,
		startDateISO: start.toISOString(),
		endDateISO: end.toISOString(),
	};
}

/** Start date (YYYY-MM-DD) of the period `direction` steps away from `start` */
export function shiftPeriod(
	start: Date,
	months: PeriodMonths,
	direction: 1 | -1,
): string {
	const next = new Date(start);
	next.setMonth(next.getMonth() + months * direction);
	return formatYYYYMMDD(next);
}
