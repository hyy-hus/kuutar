import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { NO_RECURRENCE } from "#/utils/rruleUtils";
import { RecurrenceFields } from "./RecurrenceFields";

// A Wednesday
const START = "2026-11-11T17:00";

describe("RecurrenceFields", () => {
	it("starts a weekly series from the start date's weekday", async () => {
		const onChange = vi.fn();
		renderWithProviders(
			<RecurrenceFields
				startTime={START}
				value={NO_RECURRENCE}
				onChange={onChange}
			/>,
		);
		await userEvent.selectOptions(
			screen.getByLabelText("Recurrence Interval"),
			"weekly",
		);
		expect(onChange).toHaveBeenCalledTimes(1);
		const next = onChange.mock.calls[0][0];
		expect(next.freq).toBe("weekly");
		expect(next.weekdays).toEqual([3]);
		expect(next.exdates).toEqual([]);
	});

	it("resets to no recurrence", async () => {
		const onChange = vi.fn();
		renderWithProviders(
			<RecurrenceFields
				startTime={START}
				value={{ ...NO_RECURRENCE, freq: "weekly", weekdays: [3], count: 4 }}
				onChange={onChange}
			/>,
		);
		await userEvent.selectOptions(
			screen.getByLabelText("Recurrence Interval"),
			"none",
		);
		expect(onChange).toHaveBeenCalledWith(NO_RECURRENCE);
	});
});
