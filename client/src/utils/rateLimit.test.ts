import { describe, expect, it } from "vitest";
import { retryAfterMinutes } from "./rateLimit";

const res = (status: number, retryAfter?: string) => ({
	status,
	headers: new Headers(retryAfter ? { "Retry-After": retryAfter } : {}),
});

describe("retryAfterMinutes", () => {
	it("is null for other statuses", () => {
		expect(retryAfterMinutes(res(401, "60"))).toBeNull();
		expect(retryAfterMinutes(undefined)).toBeNull();
	});

	it("rounds seconds up to whole minutes", () => {
		expect(retryAfterMinutes(res(429, "600"))).toBe(10);
		expect(retryAfterMinutes(res(429, "601"))).toBe(11);
		expect(retryAfterMinutes(res(429, "5"))).toBe(1);
	});

	it("reads an HTTP date", () => {
		const now = Date.parse("2026-11-23T12:00:00Z");
		expect(
			retryAfterMinutes(res(429, "Mon, 23 Nov 2026 12:03:00 GMT"), now),
		).toBe(3);
	});

	it("falls back to one minute without a usable header", () => {
		expect(retryAfterMinutes(res(429))).toBe(1);
		expect(retryAfterMinutes(res(429, "soon"))).toBe(1);
	});
});
