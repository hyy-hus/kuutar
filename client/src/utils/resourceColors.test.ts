import { describe, expect, it } from "vitest";
import { getResourceColor, RESOURCE_COLORS } from "./resourceColors";

describe("getResourceColor", () => {
	it("returns classes for every palette key", () => {
		for (const key of RESOURCE_COLORS) {
			expect(getResourceColor(key)?.stripe).toContain(key);
		}
	});

	it("returns undefined for missing or unknown keys", () => {
		expect(getResourceColor(undefined)).toBeUndefined();
		expect(getResourceColor(null)).toBeUndefined();
		expect(getResourceColor("chartreuse")).toBeUndefined();
		expect(getResourceColor("toString")).toBeUndefined();
	});
});
