import { formatDateTimeLocal } from "./date";

export interface DurationSettings {
	default_duration_minutes?: number | null;
	min_duration_minutes?: number | null;
	max_duration_minutes?: number | null;
}

/**
 * Booking length to pre-fill for the given resources: the longest default among those that
 * set one, kept within the strictest min/max. Undefined when no resource sets a default.
 */
export function resolveDefaultDuration(
	resources: DurationSettings[],
): number | undefined {
	const defaults = resources
		.map((r) => r.default_duration_minutes)
		.filter((m): m is number => typeof m === "number");
	if (defaults.length === 0) return undefined;

	let minutes = Math.max(...defaults);
	const mins = resources
		.map((r) => r.min_duration_minutes)
		.filter((m): m is number => typeof m === "number");
	const maxs = resources
		.map((r) => r.max_duration_minutes)
		.filter((m): m is number => typeof m === "number");
	if (mins.length > 0) minutes = Math.max(minutes, ...mins);
	// The maximum wins when resources' limits disagree
	if (maxs.length > 0) minutes = Math.min(minutes, ...maxs);
	return minutes;
}

/** Which limit a booking of `minutes` breaks for the resource, if any */
export function checkDuration(
	minutes: number,
	resource: DurationSettings,
): "min" | "max" | undefined {
	if (resource.min_duration_minutes && minutes < resource.min_duration_minutes)
		return "min";
	if (resource.max_duration_minutes && minutes > resource.max_duration_minutes)
		return "max";
	return undefined;
}

/** `start` (a datetime-local value) plus `minutes`, as a datetime-local value */
export function addMinutes(start: string, minutes: number): string {
	const date = new Date(start);
	date.setMinutes(date.getMinutes() + minutes);
	return formatDateTimeLocal(date);
}

/** e.g. 90 -> "1 h 30 min" */
export function formatMinutes(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	if (h === 0) return `${m} min`;
	return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
