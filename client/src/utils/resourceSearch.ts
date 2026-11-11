/**
 * Resource selection in a page's search params. Same shape as the calendar's `resources`
 * param: a list of ids, or undefined for "all resources". Also accepts a comma separated
 * string and the older single `resource_id` param.
 */
export function parseResourceList(
	value: unknown,
	legacySingle?: unknown,
): string[] | undefined {
	if (Array.isArray(value)) return value.filter((v) => typeof v === "string");
	if (typeof value === "string") return value.split(",").filter(Boolean);
	if (typeof legacySingle === "string" && legacySingle) return [legacySingle];
	return undefined;
}

/** Whether a reservation's occurrences touch the selected resources (undefined = all) */
export function touchesResources(
	occurrences: { resource_id: string }[] | undefined,
	selected: string[] | undefined,
): boolean {
	if (!selected) return true;
	return (occurrences ?? []).some((o) => selected.includes(o.resource_id));
}
