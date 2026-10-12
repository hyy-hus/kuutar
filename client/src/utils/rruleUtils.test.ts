import { describe, expect, it } from "vitest";
import {
	addExdate,
	generateOccurrences,
	listSeriesStarts,
	parseRRule,
	type RRuleConfig,
	removeExdate,
} from "./rruleUtils";

const weekly = (until: Date): RRuleConfig => ({
	preset: "weekly",
	until,
	exdates: [],
});

/** Local wall-clock start and end of each occurrence, e.g. "2026-10-27 18:00–20:00" */
const wallClock = (
	occurrences: { start_time: string; end_time: string }[],
): string[] =>
	occurrences.map(({ start_time, end_time }) => {
		const start = new Date(start_time);
		const end = new Date(end_time);
		const pad = (n: number) => String(n).padStart(2, "0");
		return `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())} ${pad(start.getHours())}:${pad(start.getMinutes())}–${pad(end.getHours())}:${pad(end.getMinutes())}`;
	});

describe("generateOccurrences", () => {
	it("runs in Helsinki time", () => {
		expect(process.env.TZ).toBe("Europe/Helsinki");
	});

	it("keeps weekly times across the autumn clock change", () => {
		const { occurrences } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			weekly(new Date(2026, 10, 3)),
		);
		expect(wallClock(occurrences)).toEqual([
			"2026-10-13 18:00–20:00",
			"2026-10-20 18:00–20:00",
			"2026-10-27 18:00–20:00",
			"2026-11-03 18:00–20:00",
		]);
	});

	it("keeps daily times across the spring clock change", () => {
		const { occurrences } = generateOccurrences(
			"2026-03-28T09:30",
			"2026-03-28T10:00",
			"r",
			{ preset: "daily", until: new Date(2026, 2, 30), exdates: [] },
		);
		expect(wallClock(occurrences)).toEqual([
			"2026-03-28 09:30–10:00",
			"2026-03-29 09:30–10:00",
			"2026-03-30 09:30–10:00",
		]);
	});

	it("keeps the end time of an overnight event on the night of the change", () => {
		const { occurrences } = generateOccurrences(
			"2026-10-24T22:00",
			"2026-10-25T02:00",
			"r",
			{ preset: "daily", until: new Date(2026, 9, 25), exdates: [] },
		);
		expect(wallClock(occurrences)).toEqual([
			"2026-10-24 22:00–02:00",
			"2026-10-25 22:00–02:00",
		]);
	});

	it("includes an occurrence on the until date", () => {
		const { occurrences } = generateOccurrences(
			"2026-10-13T23:00",
			"2026-10-13T23:30",
			"r",
			weekly(new Date(2026, 9, 20)),
		);
		expect(occurrences).toHaveLength(2);
	});

	it("records the time zone in the rule", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			weekly(new Date(2026, 10, 3)),
		);
		expect(rruleString).toContain(
			"DTSTART;TZID=Europe/Helsinki:20261013T180000",
		);
	});
});

describe("parseRRule", () => {
	it("reads back the until date of a generated rule", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			weekly(new Date(2026, 10, 3)),
		);
		const { preset, until } = parseRRule(rruleString);
		expect(preset).toBe("weekly");
		expect(until?.toDateString()).toBe(new Date(2026, 10, 3).toDateString());
	});

	it("reads the until date of rules saved before the fix", () => {
		// Old rules stored real UTC times: 23:59:59 Helsinki time is 21:59:59Z
		const { until } = parseRRule(
			"DTSTART:20261013T150000Z\nRRULE:FREQ=WEEKLY;UNTIL=20261103T215959Z",
		);
		expect(until?.toDateString()).toBe(new Date(2026, 10, 3).toDateString());
	});
});

/** Local dates (YYYY-MM-DD) of the occurrences of a series starting at 18:00 */
const dates = (start: string, config: RRuleConfig): string[] =>
	generateOccurrences(
		start,
		`${start.slice(0, 10)}T19:00`,
		"r",
		config,
	).occurrences.map(({ start_time }) =>
		wallClock([{ start_time, end_time: start_time }])[0].slice(0, 10),
	);

describe("presets", () => {
	it("every weekday skips weekends", () => {
		expect(
			dates("2026-10-12T18:00", {
				preset: "weekdays",
				until: new Date(2026, 9, 19),
				exdates: [],
			}),
		).toEqual([
			"2026-10-12",
			"2026-10-13",
			"2026-10-14",
			"2026-10-15",
			"2026-10-16",
			"2026-10-19",
		]);
	});

	it("weekly follows the weekday of the start date", () => {
		expect(dates("2026-10-12T18:00", weekly(new Date(2026, 9, 31)))).toEqual([
			"2026-10-12",
			"2026-10-19",
			"2026-10-26",
		]);
	});

	it("monthly on a day of the month, counted", () => {
		expect(
			dates("2026-11-01T18:00", {
				preset: "monthlyDay",
				count: 3,
				exdates: [],
			}),
		).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
	});

	it("monthly on the first Tuesday", () => {
		expect(
			dates("2026-11-03T18:00", {
				preset: "monthlyNthWeekday",
				count: 3,
				exdates: [],
			}),
		).toEqual(["2026-11-03", "2026-12-01", "2027-01-05"]);
	});

	it("monthly on the last weekday of the month when the start is the fifth one", () => {
		// 2026-11-30 is the fifth Monday of November, so it means the last Monday
		expect(
			dates("2026-11-30T18:00", {
				preset: "monthlyNthWeekday",
				count: 3,
				exdates: [],
			}),
		).toEqual(["2026-11-30", "2026-12-28", "2027-01-25"]);
	});

	it("yearly on the first Tuesday of the year", () => {
		expect(
			dates("2026-01-06T18:00", {
				preset: "yearlyNthWeekdayOfYear",
				count: 3,
				exdates: [],
			}),
		).toEqual(["2026-01-06", "2027-01-05", "2028-01-04"]);
	});

	it("yearly on the same date", () => {
		expect(
			dates("2026-12-24T18:00", {
				preset: "yearlyDate",
				count: 2,
				exdates: [],
			}),
		).toEqual(["2026-12-24", "2027-12-24"]);
	});

	it("keeps the times of a monthly series across the clock change", () => {
		const { occurrences } = generateOccurrences(
			"2026-09-15T18:00",
			"2026-09-15T20:00",
			"r",
			{ preset: "monthlyDay", count: 3, exdates: [] },
		);
		expect(wallClock(occurrences)).toEqual([
			"2026-09-15 18:00–20:00",
			"2026-10-15 18:00–20:00",
			"2026-11-15 18:00–20:00",
		]);
	});
});

describe("exceptions", () => {
	const config: RRuleConfig = {
		preset: "weekly",
		until: new Date(2026, 10, 3),
		exdates: [new Date(2026, 9, 20, 18, 0)],
	};

	it("leaves excluded dates out", () => {
		expect(dates("2026-10-13T18:00", config)).toEqual([
			"2026-10-13",
			"2026-10-27",
			"2026-11-03",
		]);
	});

	it("still lists excluded dates as candidates", () => {
		expect(listSeriesStarts("2026-10-13T18:00", config)).toHaveLength(4);
	});

	it("round-trips through the stored rule", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			config,
		);
		expect(rruleString).toContain(
			"EXDATE;TZID=Europe/Helsinki:20261020T180000",
		);
		const parsed = parseRRule(rruleString);
		expect(parsed.preset).toBe("weekly");
		expect(parsed.exdates).toEqual(config.exdates);
		expect(parsed.dtstart).toEqual(new Date(2026, 9, 13, 18, 0));
	});

	it("keeps the series start when the first occurrence is excluded", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			{ ...config, exdates: [new Date(2026, 9, 13, 18, 0)] },
		);
		expect(parseRRule(rruleString).dtstart).toEqual(
			new Date(2026, 9, 13, 18, 0),
		);
	});

	it("adds and removes an exception in a stored rule", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			weekly(new Date(2026, 10, 3)),
		);
		const added = addExdate(
			rruleString as string,
			new Date(2026, 9, 27, 18, 0),
		);
		expect(parseRRule(added).exdates).toEqual([new Date(2026, 9, 27, 18, 0)]);
		expect(parseRRule(added).preset).toBe("weekly");
		expect(added).toContain("DTSTART;TZID=Europe/Helsinki:20261013T180000");
		const removed = removeExdate(added, new Date(2026, 9, 27, 18, 0));
		expect(parseRRule(removed).exdates).toEqual([]);
	});
});

describe("parseRRule presets", () => {
	it("recognises a legacy monthly rule without BYMONTHDAY", () => {
		expect(
			parseRRule(
				"DTSTART:20261013T150000Z\nRRULE:FREQ=MONTHLY;UNTIL=20271103T215959Z",
			).preset,
		).toBe("monthlyDay");
	});

	it("recognises the first Tuesday of the month", () => {
		expect(
			parseRRule(
				"DTSTART;TZID=Europe/Helsinki:20261103T180000\nRRULE:FREQ=MONTHLY;BYDAY=+1TU;COUNT=4",
			),
		).toMatchObject({ preset: "monthlyNthWeekday", count: 4 });
	});

	it("keeps a rule it has no preset for as custom", () => {
		const parsed = parseRRule(
			"DTSTART;TZID=Europe/Helsinki:20261013T180000\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=3",
		);
		expect(parsed.preset).toBe("custom");
		const { occurrences } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			parsed,
		);
		expect(wallClock(occurrences)).toEqual([
			"2026-10-13 18:00–20:00",
			"2026-10-27 18:00–20:00",
			"2026-11-10 18:00–20:00",
		]);
	});
});

describe("generateOccurrences without a resource", () => {
	it("still generates the times, for restrictions that apply to every resource", () => {
		const { occurrences } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"",
			{ preset: "daily", count: 2, exdates: [] },
		);
		expect(occurrences).toHaveLength(2);
	});
});
