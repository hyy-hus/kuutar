export const STATS_RANGES = ["30d", "90d", "12m", "all"] as const;
export type StatsRange = (typeof STATS_RANGES)[number];

export const DEFAULT_STATS_RANGE: StatsRange = "90d";

/** Narrows an unknown search param to a valid range, falling back to the default */
export function parseStatsRange(value: unknown): StatsRange {
	return STATS_RANGES.find((r) => r === value) ?? DEFAULT_STATS_RANGE;
}

/** Heatmap intensity from 0 (empty) to 4 (busiest) */
export function heatLevel(count: number, max: number): 0 | 1 | 2 | 3 | 4 {
	if (count <= 0 || max <= 0) return 0;
	return Math.min(4, Math.max(1, Math.ceil((count / max) * 4))) as
		| 1
		| 2
		| 3
		| 4;
}

/** "2026-03" as a short localized month, e.g. "maalis 26" */
export function formatMonth(month: string, locale: string): string {
	const [year, m] = month.split("-").map(Number);
	if (!year || !m) return month;
	return new Date(Date.UTC(year, m - 1, 1)).toLocaleDateString(locale, {
		month: "short",
		year: "2-digit",
		timeZone: "UTC",
	});
}

/** Hours with at most one decimal, dropping a trailing ".0" */
export function formatHours(hours: number, locale: string): string {
	return hours.toLocaleString(locale, { maximumFractionDigits: 1 });
}
