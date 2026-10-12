import { describe, expect, it } from "vitest";
import { generateOccurrences, NO_RECURRENCE, parseRRule } from "./rruleUtils";
import { canSplitOccurrence, planSplit, seriesFirstTimes } from "./series";

const series = generateOccurrences(
	"2026-10-13T18:00",
	"2026-10-13T20:00",
	"res-a",
	{ ...NO_RECURRENCE, freq: "weekly", weekdays: [2], count: 3 },
);
const rows = series.occurrences.map((o, i) => ({ ...o, id: `a${i}` }));

describe("planSplit", () => {
	it("excludes the occurrence from the rule it leaves behind", () => {
		const plan = planSplit(series.rruleString as string, rows, rows[1]);
		expect(plan.occurrence_ids).toEqual(["a1"]);
		expect(parseRRule(plan.rrule).exdates).toEqual([new Date(2026, 9, 20, 18)]);
	});

	it("takes the rows of every resource at that time", () => {
		const second = rows.map((o) => ({
			...o,
			id: `b${o.id}`,
			resource_id: "res-b",
		}));
		const plan = planSplit(
			series.rruleString as string,
			[...rows, ...second],
			rows[0],
		);
		expect(plan.occurrence_ids.sort()).toEqual(["a0", "ba0"]);
	});

	it("keeps a rule it can't read", () => {
		expect(planSplit("nonsense", rows, rows[0]).rrule).toBe("nonsense");
	});
});

describe("canSplitOccurrence", () => {
	it("needs a rule and other times in the series", () => {
		expect(canSplitOccurrence(series.rruleString, rows, rows[0])).toBe(true);
		expect(canSplitOccurrence(null, rows, rows[0])).toBe(false);
		expect(canSplitOccurrence(series.rruleString, [rows[0]], rows[0])).toBe(
			false,
		);
	});
});

describe("seriesFirstTimes", () => {
	it("starts from the rule when the first occurrence was excluded", () => {
		const { rruleString, occurrences } = generateOccurrences(
			"2026-10-13T18:00",
			"2026-10-13T20:00",
			"r",
			{
				...NO_RECURRENCE,
				freq: "weekly",
				weekdays: [2],
				count: 3,
				exdates: [new Date(2026, 9, 13, 18)],
			},
		);
		const { start, end } = seriesFirstTimes(rruleString, occurrences[0]);
		expect(start).toEqual(new Date(2026, 9, 13, 18));
		expect(end).toEqual(new Date(2026, 9, 13, 20));
	});

	it("uses the first occurrence when there is no rule", () => {
		const { start } = seriesFirstTimes(null, {
			start_time: "2026-10-13T15:00:00Z",
			end_time: "2026-10-13T17:00:00Z",
		});
		expect(start.toISOString()).toBe("2026-10-13T15:00:00.000Z");
	});
});
