import { RRule } from "rrule";
import { describe, expect, it } from "vitest";
import { generateOccurrences, parseRRule } from "./rruleUtils";

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
			{ freq: RRule.WEEKLY, until: new Date(2026, 10, 3) },
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
			{ freq: RRule.DAILY, until: new Date(2026, 2, 30) },
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
			{ freq: RRule.DAILY, until: new Date(2026, 9, 25) },
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
			{ freq: RRule.WEEKLY, until: new Date(2026, 9, 20) },
		);
		expect(occurrences).toHaveLength(2);
	});

	it("records the time zone in the rule", () => {
		const { rruleString } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			{ freq: RRule.WEEKLY, until: new Date(2026, 10, 3) },
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
			{ freq: RRule.WEEKLY, until: new Date(2026, 10, 3) },
		);
		const { freq, until } = parseRRule(rruleString);
		expect(freq).toBe(RRule.WEEKLY);
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
