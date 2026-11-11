import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import { DetailLayout } from "./DetailLayout";

describe("DetailLayout", () => {
	it("renders title, body, danger section and technical details", () => {
		renderWithProviders(
			<DetailLayout
				title="Crystal Hall"
				dangerZone={<button type="button">Delete</button>}
				technical={{
					id: "abc-123",
					createdAt: "2026-09-01T09:00:00Z",
					updatedAt: "2026-09-01T09:00:00Z",
				}}
			>
				<p>Body</p>
			</DetailLayout>,
		);
		expect(
			screen.getByRole("heading", { level: 1, name: "Crystal Hall" }),
		).toBeInTheDocument();
		expect(screen.getByText("Body")).toBeInTheDocument();
		expect(screen.getByText("Danger zone")).toBeInTheDocument();
		expect(screen.getByText("Technical details")).toBeInTheDocument();
		expect(screen.getByText("abc-123")).toBeInTheDocument();
		// Unchanged since creation: no separate "Modified" row
		expect(screen.getByText("Created:")).toBeInTheDocument();
		expect(screen.queryByText("Modified:")).not.toBeInTheDocument();
	});

	it("omits the optional sections", () => {
		renderWithProviders(<DetailLayout title="X">Body</DetailLayout>);
		expect(screen.queryByText("Danger zone")).not.toBeInTheDocument();
		expect(screen.queryByText("Technical details")).not.toBeInTheDocument();
	});
});
