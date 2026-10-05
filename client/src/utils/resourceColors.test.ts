import { describe, expect, it } from "vitest";
import {
	DEFAULT_CHART_COLOR,
	getResourceColor,
	getResourceHex,
	RESOURCE_COLORS,
} from "./resourceColors";

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

describe("getResourceHex", () => {
	it("returns the hex for every palette key", () => {
		for (const key of RESOURCE_COLORS) {
			expect(getResourceHex(key)).toMatch(/^#[0-9a-f]{6}$/);
			expect(getResourceHex(key)).not.toBe(DEFAULT_CHART_COLOR);
		}
	});

	it("falls back to the default for missing or unknown keys", () => {
		for (const key of [undefined, null, "", "chartreuse", "toString"]) {
			expect(getResourceHex(key)).toBe(DEFAULT_CHART_COLOR);
		}
	});
});
