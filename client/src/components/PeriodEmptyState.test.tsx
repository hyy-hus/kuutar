import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { PeriodEmptyState } from "./PeriodEmptyState";

describe("PeriodEmptyState", () => {
	it("names the time frame and offers the next longer period", async () => {
		const onChange = vi.fn();
		renderWithProviders(
			<PeriodEmptyState
				start={new Date(2026, 10, 1)}
				months={1}
				what="reservations"
				onChange={onChange}
			/>,
		);
		expect(
			screen.getByText(/No reservations in the period/),
		).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Show 3 months" }),
		);
		expect(onChange).toHaveBeenCalledWith({ months: 3 });
	});

	it("has no extend button at the longest period", () => {
		renderWithProviders(
			<PeriodEmptyState
				start={new Date(2026, 0, 1)}
				months={12}
				what="reservations"
				onChange={() => {}}
			/>,
		);
		expect(screen.queryByRole("button")).toBeNull();
		expect(screen.getByText(/longest period/)).toBeInTheDocument();
	});
});
