import { describe, expect, it } from "vitest";
import {
	addExdate,
	generateOccurrences,
	listSeriesStarts,
	NO_RECURRENCE,
	parseRRule,
	type RRuleConfig,
	removeExdate,
} from "./rruleUtils";

const MON = 1;
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

const config = (overrides: Partial<RRuleConfig>): RRuleConfig => ({
	...NO_RECURRENCE,
	...overrides,
});

/** Weekly on Tuesdays, which is what the 2026-10-13 starts below are */
const weekly = (until: Date): RRuleConfig =>
	config({ freq: "weekly", weekdays: [TUE], until });

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
			config({
				freq: "weekly",
				weekdays: ALL_DAYS,
				until: new Date(2026, 2, 30),
			}),
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
			config({
				freq: "weekly",
				weekdays: ALL_DAYS,
				until: new Date(2026, 9, 25),
			}),
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
		const { freq, until } = parseRRule(rruleString);
		expect(freq).toBe("weekly");
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

describe("patterns", () => {
	it("a daily series on chosen weekdays skips the others", () => {
		expect(
			dates(
				"2026-10-12T18:00",
				config({
					freq: "weekly",
					weekdays: [MON, WED, FRI],
					until: new Date(2026, 9, 19),
				}),
			),
		).toEqual(["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-19"]);
	});

	it("Monday to Friday skips weekends", () => {
		expect(
			dates(
				"2026-10-12T18:00",
				config({
					freq: "weekly",
					weekdays: [MON, TUE, WED, THU, FRI],
					until: new Date(2026, 9, 19),
				}),
			),
		).toEqual([
			"2026-10-12",
			"2026-10-13",
			"2026-10-14",
			"2026-10-15",
			"2026-10-16",
			"2026-10-19",
		]);
	});

	it("starts on the first matching day when the start day isn't chosen", () => {
		expect(
			dates(
				"2026-10-12T18:00",
				config({ freq: "weekly", weekdays: [WED], count: 2 }),
			),
		).toEqual(["2026-10-14", "2026-10-21"]);
	});

	it("all seven weekdays is written as a daily rule", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-12T18:00",
			"2026-10-12T19:00",
			"r",
			config({ freq: "weekly", weekdays: ALL_DAYS, count: 3 }),
		);
		expect(rruleString).toContain("FREQ=DAILY");
	});

	it("monthly on a day of the month", () => {
		expect(
			dates(
				"2026-11-01T18:00",
				config({ freq: "monthly", monthDay: 1, count: 3 }),
			),
		).toEqual(["2026-11-01", "2026-12-01", "2027-01-01"]);
	});

	it("monthly on the last day of the month", () => {
		expect(
			dates(
				"2026-11-30T18:00",
				config({ freq: "monthly", monthDay: -1, count: 3 }),
			),
		).toEqual(["2026-11-30", "2026-12-31", "2027-01-31"]);
	});

	it("monthly on the first Tuesday", () => {
		expect(
			dates(
				"2026-11-03T18:00",
				config({
					freq: "monthly",
					monthlyMode: "nthWeekday",
					nth: 1,
					nthWeekday: TUE,
					count: 3,
				}),
			),
		).toEqual(["2026-11-03", "2026-12-01", "2027-01-05"]);
	});

	it("monthly on the last Monday", () => {
		expect(
			dates(
				"2026-11-30T18:00",
				config({
					freq: "monthly",
					monthlyMode: "nthWeekday",
					nth: -1,
					nthWeekday: MON,
					count: 3,
				}),
			),
		).toEqual(["2026-11-30", "2026-12-28", "2027-01-25"]);
	});

	it("yearly on a chosen date", () => {
		expect(
			dates(
				"2026-12-24T18:00",
				config({ freq: "yearly", yearMonth: 12, yearDay: 24, count: 2 }),
			),
		).toEqual(["2026-12-24", "2027-12-24"]);
	});

	it("yearly on a date other than the start date begins at its next turn", () => {
		expect(
			dates(
				"2026-10-12T18:00",
				config({ freq: "yearly", yearMonth: 5, yearDay: 1, count: 2 }),
			),
		).toEqual(["2027-05-01", "2028-05-01"]);
	});

	it("keeps the times of a monthly series across the clock change", () => {
		const { occurrences } = generateOccurrences(
			"2026-09-15T18:00",
			"2026-09-15T20:00",
			"r",
			config({ freq: "monthly", monthDay: 15, count: 3 }),
		);
		expect(wallClock(occurrences)).toEqual([
			"2026-09-15 18:00–20:00",
			"2026-10-15 18:00–20:00",
			"2026-11-15 18:00–20:00",
		]);
	});
});

describe("exceptions", () => {
	const exceptional: RRuleConfig = {
		...weekly(new Date(2026, 10, 3)),
		exdates: [new Date(2026, 9, 20, 18, 0)],
	};

	it("leaves excluded dates out", () => {
		expect(dates("2026-10-13T18:00", exceptional)).toEqual([
			"2026-10-13",
			"2026-10-27",
			"2026-11-03",
		]);
	});

	it("still lists excluded dates as candidates", () => {
		expect(listSeriesStarts("2026-10-13T18:00", exceptional)).toHaveLength(4);
	});

	it("round-trips through the stored rule", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			exceptional,
		);
		expect(rruleString).toContain(
			"EXDATE;TZID=Europe/Helsinki:20261020T180000",
		);
		const parsed = parseRRule(rruleString);
		expect(parsed.freq).toBe("weekly");
		expect(parsed.exdates).toEqual(exceptional.exdates);
		expect(parsed.dtstart).toEqual(new Date(2026, 9, 13, 18, 0));
	});

	it("keeps the series start when the first occurrence is excluded", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			{ ...exceptional, exdates: [new Date(2026, 9, 13, 18, 0)] },
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
		expect(parseRRule(added).freq).toBe("weekly");
		expect(added).toContain("DTSTART;TZID=Europe/Helsinki:20261013T180000");
		const removed = removeExdate(added, new Date(2026, 9, 27, 18, 0));
		expect(parseRRule(removed).exdates).toEqual([]);
	});
});

describe("parseRRule patterns", () => {
	const parse = (rule: string) =>
		parseRRule(`DTSTART;TZID=Europe/Helsinki:20261103T180000\nRRULE:${rule}`);

	it("recognises a legacy monthly rule without BYMONTHDAY", () => {
		expect(
			parseRRule(
				"DTSTART:20261013T150000Z\nRRULE:FREQ=MONTHLY;UNTIL=20271103T215959Z",
			),
		).toMatchObject({ freq: "monthly", monthlyMode: "day", monthDay: 13 });
	});

	it("recognises a legacy daily rule as every weekday of the week", () => {
		expect(parse("FREQ=DAILY;COUNT=3")).toMatchObject({
			freq: "weekly",
			weekdays: ALL_DAYS,
		});
	});

	it("reads the chosen weekdays", () => {
		expect(parse("FREQ=WEEKLY;BYDAY=MO,WE,SU;COUNT=3")).toMatchObject({
			freq: "weekly",
			weekdays: [0, MON, WED],
		});
	});

	it("recognises the first Tuesday of the month", () => {
		expect(parse("FREQ=MONTHLY;BYDAY=+1TU;COUNT=4")).toMatchObject({
			freq: "monthly",
			monthlyMode: "nthWeekday",
			nth: 1,
			nthWeekday: TUE,
			count: 4,
		});
	});

	it("reads the month and day of a yearly rule", () => {
		expect(parse("FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=1;COUNT=2")).toMatchObject({
			freq: "yearly",
			yearMonth: 5,
			yearDay: 1,
		});
	});

	it("fills in a yearly rule's missing month and day from its start", () => {
		expect(parse("FREQ=YEARLY;COUNT=2")).toMatchObject({
			freq: "yearly",
			yearMonth: 11,
			yearDay: 3,
		});
	});

	it("keeps rules the form can't express as custom", () => {
		for (const rule of [
			"FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=3",
			"FREQ=MONTHLY;BYDAY=5TU;COUNT=3",
			"FREQ=YEARLY;BYDAY=1TU;COUNT=3",
			"FREQ=YEARLY;BYMONTHDAY=-1;COUNT=3",
		]) {
			expect(parse(rule).freq, rule).toBe("custom");
		}
	});

	it("generates a custom rule unchanged", () => {
		const parsed = parse("FREQ=WEEKLY;INTERVAL=2;BYDAY=TU;COUNT=3");
		const { occurrences } = generateOccurrences(
			"2026-11-03T18:00",
			"2026-11-03T20:00",
			"r",
			parsed,
		);
		expect(wallClock(occurrences)).toEqual([
			"2026-11-03 18:00–20:00",
			"2026-11-17 18:00–20:00",
			"2026-12-01 18:00–20:00",
		]);
	});
});

describe("generateOccurrences without a resource", () => {
	it("still generates the times, for restrictions that apply to every resource", () => {
		const { occurrences } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"",
			config({ freq: "weekly", weekdays: ALL_DAYS, count: 2 }),
		);
		expect(occurrences).toHaveLength(2);
	});
});
