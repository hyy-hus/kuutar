/**
 * Minutes to wait before retrying a rate-limited (429) request, rounded up, from its
 * `Retry-After` header. Null when the response is not a 429. A missing or unreadable
 * header (seconds or an HTTP date) counts as one minute.
 */
export function retryAfterMinutes(
	response: Pick<Response, "status" | "headers"> | undefined,
	now = Date.now(),
): number | null {
	if (response?.status !== 429) return null;
	const header = response.headers.get("Retry-After")?.trim() ?? "";
	let seconds = /^\d+$/.test(header) ? Number(header) : Number.NaN;
	if (Number.isNaN(seconds) && header) {
		const date = Date.parse(header);
		if (!Number.isNaN(date)) seconds = (date - now) / 1000;
	}
	if (Number.isNaN(seconds)) return 1;
	return Math.max(1, Math.ceil(seconds / 60));
}
