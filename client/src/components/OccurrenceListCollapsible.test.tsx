import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import {
	OccurrenceListCollapsible,
	type OccurrenceListItem,
} from "./OccurrenceListCollapsible";

const makeItems = (count: number, groupLabel: string): OccurrenceListItem[] =>
	Array.from({ length: count }, (_, i) => ({
		id: `${groupLabel}-${i}`,
		start_time: new Date(2026, 10, 1 + i, 17).toISOString(),
		end_time: new Date(2026, 10, 1 + i, 19).toISOString(),
		groupLabel,
	}));

describe("OccurrenceListCollapsible", () => {
	it("shows five rows per group and expands on request", () => {
		renderWithProviders(
			<OccurrenceListCollapsible items={makeItems(12, "Sauna")} />,
		);
		expect(screen.getAllByRole("listitem")).toHaveLength(5);
		fireEvent.click(screen.getByRole("button", { name: /12/ }));
		expect(screen.getAllByRole("listitem")).toHaveLength(12);
		fireEvent.click(screen.getByRole("button", { name: /Show fewer/i }));
		expect(screen.getAllByRole("listitem")).toHaveLength(5);
	});

	it("groups by resource and has no toggle for short groups", () => {
		renderWithProviders(
			<OccurrenceListCollapsible
				items={[...makeItems(2, "Sauna"), ...makeItems(3, "Club room")]}
			/>,
		);
		expect(screen.getByText("Sauna")).toBeTruthy();
		expect(screen.getByText("Club room")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});
});
