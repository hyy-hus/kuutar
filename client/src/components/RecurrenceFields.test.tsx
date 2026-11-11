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

	it("toggles weekdays as checkbox chips and offers quick picks", async () => {
		const onChange = vi.fn();
		renderWithProviders(
			<RecurrenceFields
				startTime={START}
				value={{ ...NO_RECURRENCE, freq: "weekly", weekdays: [3], count: 4 }}
				onChange={onChange}
			/>,
		);
		expect(screen.getByRole("checkbox", { name: "Wed" })).toBeTruthy();
		expect(
			screen
				.getByRole("checkbox", { name: "Wed" })
				.getAttribute("aria-checked"),
		).toBe("true");
		await userEvent.click(screen.getByRole("checkbox", { name: "Mon" }));
		expect(onChange.mock.calls[0][0].weekdays).toEqual([1, 3]);
		await userEvent.click(
			screen.getByRole("button", { name: "Weekdays Mon–Fri" }),
		);
		expect(onChange.mock.calls[1][0].weekdays).toEqual([1, 2, 3, 4, 5]);
	});

	it("summarises the series and counts exceptions", () => {
		renderWithProviders(
			<RecurrenceFields
				startTime={START}
				value={{
					...NO_RECURRENCE,
					freq: "weekly",
					weekdays: [3],
					count: 4,
					exdates: [new Date("2026-11-18T17:00")],
				}}
				onChange={() => {}}
			/>,
		);
		expect(screen.getByText(/Repeats weekly on Wed/)).toBeTruthy();
		expect(screen.getByText(/3 times/)).toBeTruthy();
		expect(screen.getByText("Exceptions (1 / 4 days)")).toBeTruthy();
	});

	it("selects all or none of the exception dates", async () => {
		const onChange = vi.fn();
		renderWithProviders(
			<RecurrenceFields
				startTime={START}
				value={{ ...NO_RECURRENCE, freq: "weekly", weekdays: [3], count: 4 }}
				onChange={onChange}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: "None" }));
		expect(onChange.mock.calls[0][0].exdates).toHaveLength(4);
	});
});
