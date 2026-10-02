import { describe, expect, it } from "vitest";
import {
	addDays,
	formatYYYYMMDD,
	localDayRangeISO,
	parseLocalDate,
	startOfWeek,
} from "./date";

describe("local date helpers", () => {
	it("parses YYYY-MM-DD as local midnight, not UTC", () => {
		const d = parseLocalDate("2026-11-03");
		expect([d.getDate(), d.getHours()]).toEqual([3, 0]);
		expect(formatYYYYMMDD(d)).toBe("2026-11-03");
	});

	it("adds calendar days across a clock change", () => {
		// 2026-10-25 is 25 hours long in Helsinki
		expect(formatYYYYMMDD(addDays(new Date(2026, 9, 24, 12), 2))).toBe(
			"2026-10-26",
		);
		expect(addDays(new Date(2026, 9, 24, 12), 2).getHours()).toBe(0);
	});

	it("finds Monday 00:00 of the week", () => {
		const sunday = new Date(2026, 9, 4, 15, 30);
		const monday = startOfWeek(sunday);
		expect(formatYYYYMMDD(monday)).toBe("2026-09-28");
		expect(monday.getHours()).toBe(0);
		expect(formatYYYYMMDD(startOfWeek(new Date(2026, 8, 28, 8)))).toBe(
			"2026-09-28",
		);
	});

	it("spans whole local days, including both ends", () => {
		const { startISO, endISO } = localDayRangeISO(
			parseLocalDate("2026-10-25"),
			parseLocalDate("2026-10-25"),
		);
		// Helsinki is UTC+3 before the change and UTC+2 after it
		expect(startISO).toBe("2026-10-24T21:00:00.000Z");
		expect(endISO).toBe("2026-10-25T21:59:59.999Z");
	});
});
