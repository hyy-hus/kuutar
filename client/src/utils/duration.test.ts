import { describe, expect, it } from "vitest";
import {
	addMinutes,
	checkDuration,
	formatMinutes,
	resolveDefaultDuration,
} from "./duration";

describe("resolveDefaultDuration", () => {
	it("is undefined without a default", () => {
		expect(resolveDefaultDuration([])).toBeUndefined();
		expect(
			resolveDefaultDuration([{ min_duration_minutes: 30 }]),
		).toBeUndefined();
	});

	it("uses the longest default", () => {
		expect(
			resolveDefaultDuration([
				{ default_duration_minutes: 60 },
				{ default_duration_minutes: 180 },
				{},
			]),
		).toBe(180);
	});

	it("clamps to the strictest limits, max winning", () => {
		expect(
			resolveDefaultDuration([
				{ default_duration_minutes: 60 },
				{ min_duration_minutes: 90 },
			]),
		).toBe(90);
		expect(
			resolveDefaultDuration([
				{ default_duration_minutes: 240, max_duration_minutes: 120 },
				{ min_duration_minutes: 180 },
			]),
		).toBe(120);
	});
});

describe("checkDuration", () => {
	const res = { min_duration_minutes: 60, max_duration_minutes: 240 };
	it("flags durations outside the limits", () => {
		expect(checkDuration(30, res)).toBe("min");
		expect(checkDuration(300, res)).toBe("max");
		expect(checkDuration(60, res)).toBeUndefined();
		expect(checkDuration(240, res)).toBeUndefined();
		expect(checkDuration(10000, {})).toBeUndefined();
	});
});

describe("addMinutes / formatMinutes", () => {
	it("adds minutes across midnight", () => {
		expect(addMinutes("2026-10-06T23:00", 120)).toBe("2026-10-07T01:00");
	});
	it("formats durations", () => {
		expect(formatMinutes(45)).toBe("45 min");
		expect(formatMinutes(120)).toBe("2 h");
		expect(formatMinutes(90)).toBe("1 h 30 min");
	});
});
