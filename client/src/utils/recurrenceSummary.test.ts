import { describe, expect, it } from "vitest";
import { weekdayRuns } from "./recurrenceSummary";

describe("weekdayRuns", () => {
	it("collapses Monday to Sunday into one run", () => {
		expect(weekdayRuns([0, 1, 2, 3, 4, 5, 6])).toEqual([{ from: 1, to: 0 }]);
	});
	it("splits runs at gaps, Monday first", () => {
		expect(weekdayRuns([1, 2, 3, 4, 5])).toEqual([{ from: 1, to: 5 }]);
		expect(weekdayRuns([1, 2, 3, 4, 5, 0])).toEqual([
			{ from: 1, to: 5 },
			{ from: 0, to: 0 },
		]);
		expect(weekdayRuns([3, 1])).toEqual([
			{ from: 1, to: 1 },
			{ from: 3, to: 3 },
		]);
	});
	it("returns nothing for no days", () => {
		expect(weekdayRuns([])).toEqual([]);
	});
});
