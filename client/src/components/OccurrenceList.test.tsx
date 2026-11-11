import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import { OccurrenceList } from "./OccurrenceList";

const make = (resourceId: string, count: number) =>
	Array.from({ length: count }, (_, i) => ({
		id: `${resourceId}-${i}`,
		resource_id: resourceId,
		start_time: new Date(Date.UTC(2026, 10, 12 + i, 8, 0)).toISOString(),
		end_time: new Date(Date.UTC(2026, 10, 12 + i, 10, 0)).toISOString(),
	}));

describe("OccurrenceList", () => {
	it("shows each resource once and collapses long groups", async () => {
		renderWithProviders(
			<OccurrenceList
				occurrences={[...make("a", 8), ...make("b", 2)]}
				resourceNames={{ a: "Crystal Hall", b: "Aurora Room" }}
			/>,
		);
		expect(
			screen.getByRole("heading", { name: /Crystal Hall/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: /Aurora Room/ }),
		).toBeInTheDocument();
		// 5 of 8 + 2 rows
		expect(screen.getAllByRole("listitem")).toHaveLength(7);

		await userEvent.click(screen.getByRole("button", { name: "Show all 8" }));
		expect(screen.getAllByRole("listitem")).toHaveLength(10);
		await userEvent.click(screen.getByRole("button", { name: "Show less" }));
		expect(screen.getAllByRole("listitem")).toHaveLength(7);
	});

	it("renders the per-row action", () => {
		renderWithProviders(
			<OccurrenceList
				occurrences={make("a", 2)}
				renderAction={(occ) => <button type="button">Act {occ.id}</button>}
			/>,
		);
		expect(screen.getByText("Act a-0")).toBeInTheDocument();
		expect(screen.getByText("Act a-1")).toBeInTheDocument();
	});
});
