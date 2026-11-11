import { screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { AgendaView } from "./AgendaView";

const monthStart = new Date(2026, 10, 1);

function event(id: string, title: string, day: number, hour: number) {
	return {
		id,
		reservationId: id,
		title,
		start: new Date(2026, 10, day, hour),
		end: new Date(2026, 10, day, hour + 1),
		resourceId: "r1",
		status: "confirmed",
	} satisfies CalendarEvent;
}

describe("AgendaView", () => {
	it("groups reservations by day, skipping empty days", () => {
		renderWithProviders(
			<AgendaView
				monthStart={monthStart}
				events={[
					event("b", "Second", 12, 9),
					event("c", "Third", 12, 15),
					event("a", "First", 3, 10),
				]}
			/>,
		);
		const sections = screen.getAllByRole("heading", { level: 2 });
		expect(sections).toHaveLength(2);
		const list = within(
			sections[1].closest("section") as HTMLElement,
		).getAllByRole("link");
		expect(list.map((l) => l.textContent)).toEqual([
			expect.stringContaining("Second"),
			expect.stringContaining("Third"),
		]);
	});

	it("links each reservation to its page", () => {
		renderWithProviders(
			<AgendaView
				monthStart={monthStart}
				events={[event("x1", "Sitsit", 5, 18)]}
			/>,
		);
		expect(screen.getByRole("link", { name: /Sitsit/ })).toHaveAttribute(
			"href",
			"/reservations/x1",
		);
	});

	it("shows an empty state when the month has nothing", () => {
		renderWithProviders(<AgendaView monthStart={monthStart} events={[]} />);
		expect(screen.getByText("No reservations this month")).toBeInTheDocument();
	});
});
