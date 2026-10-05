import { describe, expect, it } from "vitest";
import {
	DEFAULT_STATS_RANGE,
	formatMonth,
	heatLevel,
	parseStatsRange,
} from "./statsUtils";

describe("parseStatsRange", () => {
	it("accepts valid ranges", () => {
		for (const r of ["30d", "90d", "12m", "all"]) {
			expect(parseStatsRange(r)).toBe(r);
		}
	});

	it("falls back to the default", () => {
		for (const r of [undefined, "", "forever", 30, null]) {
			expect(parseStatsRange(r)).toBe(DEFAULT_STATS_RANGE);
		}
	});
});

describe("heatLevel", () => {
	it("is 0 for empty cells or no data", () => {
		expect(heatLevel(0, 10)).toBe(0);
		expect(heatLevel(5, 0)).toBe(0);
	});

	it("scales between 1 and 4", () => {
		expect(heatLevel(1, 100)).toBe(1);
		expect(heatLevel(50, 100)).toBe(2);
		expect(heatLevel(75, 100)).toBe(3);
		expect(heatLevel(100, 100)).toBe(4);
	});
});

describe("formatMonth", () => {
	it("formats a month and returns malformed input unchanged", () => {
		expect(formatMonth("2026-03", "en")).toContain("26");
		expect(formatMonth("garbage", "en")).toBe("garbage");
	});
});
