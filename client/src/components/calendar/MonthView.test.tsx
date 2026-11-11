import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { MonthView } from "./MonthView";

const monthStart = new Date(2026, 10, 1); // November 2026

function event(
	overrides: Partial<CalendarEvent> & { id: string },
): CalendarEvent {
	return {
		reservationId: overrides.id,
		title: "Board meeting",
		start: new Date(2026, 10, 11, 17, 0),
		end: new Date(2026, 10, 11, 19, 0),
		resourceId: "r1",
		status: "confirmed",
		...overrides,
	};
}

describe("MonthView", () => {
	it("lists a reservation as a link to its page", () => {
		renderWithProviders(
			<MonthView monthStart={monthStart} events={[event({ id: "abc" })]} />,
		);
		const link = screen.getByRole("link", { name: /Board meeting/ });
		expect(link).toHaveAttribute("href", "/reservations/abc");
	});

	it("marks pending reservations in the tooltip", () => {
		renderWithProviders(
			<MonthView
				monthStart={monthStart}
				events={[event({ id: "p1", status: "pending", title: "Sitsit" })]}
			/>,
		);
		expect(screen.getByRole("link", { name: /Sitsit/ })).toHaveAttribute(
			"title",
			expect.stringContaining("["),
		);
	});

	it("sorts a day's events by start time", () => {
		renderWithProviders(
			<MonthView
				monthStart={monthStart}
				events={[
					event({
						id: "late",
						title: "Late",
						start: new Date(2026, 10, 11, 20),
						end: new Date(2026, 10, 11, 21),
					}),
					event({
						id: "early",
						title: "Early",
						start: new Date(2026, 10, 11, 8),
						end: new Date(2026, 10, 11, 9),
					}),
				]}
			/>,
		);
		const titles = screen.getAllByRole("link").map((l) => l.textContent);
		expect(titles[0]).toContain("Early");
		expect(titles[1]).toContain("Late");
	});

	it("keeps restrictions and bookable blocks out of the month list", () => {
		renderWithProviders(
			<MonthView
				monthStart={monthStart}
				events={[
					event({ id: "x", title: "Christmas closure", isRestriction: true }),
					event({ id: "y", title: "Open slot", isBlock: true }),
				]}
			/>,
		);
		expect(screen.queryByRole("link")).not.toBeInTheDocument();
	});

	it("lists a multi-day reservation on every day it touches", () => {
		renderWithProviders(
			<MonthView
				monthStart={monthStart}
				events={[
					event({
						id: "tent",
						title: "Tent loan",
						start: new Date(2026, 10, 12, 10),
						end: new Date(2026, 10, 14, 16),
					}),
				]}
			/>,
		);
		expect(screen.getAllByRole("link", { name: /Tent loan/ })).toHaveLength(3);
	});

	it("reports the clicked day", async () => {
		const onDayClick = vi.fn();
		renderWithProviders(
			<MonthView monthStart={monthStart} events={[]} onDayClick={onDayClick} />,
		);
		const day = within(document.body).getAllByRole("button", { name: "11" })[0];
		await userEvent.click(day);
		expect(onDayClick).toHaveBeenCalledTimes(1);
		expect(onDayClick.mock.calls[0][0].getDate()).toBe(11);
	});

	it("collapses a crowded day into a +N more link that opens the day", async () => {
		const onDayClick = vi.fn();
		const crowded = Array.from({ length: 6 }, (_, i) =>
			event({
				id: `c${i}`,
				title: `Event ${i}`,
				start: new Date(2026, 10, 11, 8 + i),
				end: new Date(2026, 10, 11, 9 + i),
			}),
		);
		renderWithProviders(
			<MonthView
				monthStart={monthStart}
				events={crowded}
				onDayClick={onDayClick}
			/>,
		);
		expect(screen.getAllByRole("link")).toHaveLength(2);
		await userEvent.click(screen.getByRole("button", { name: "+4 more" }));
		expect(onDayClick.mock.calls[0][0].getDate()).toBe(11);
	});

	it("shows no overflow link when the day fits", () => {
		renderWithProviders(
			<MonthView monthStart={monthStart} events={[event({ id: "a" })]} />,
		);
		expect(screen.queryByRole("button", { name: /more/ })).toBeNull();
	});
});
