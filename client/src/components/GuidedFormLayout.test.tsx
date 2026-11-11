import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import { FormDetails } from "./FormDetails";
import { FormSection } from "./FormSection";
import { GuidedFormLayout } from "./GuidedFormLayout";
import { StickyFormActions } from "./StickyFormActions";

describe("GuidedFormLayout", () => {
	it("lists the sections in the index and numbers them", () => {
		renderWithProviders(
			<GuidedFormLayout
				index={[
					{ id: "a", label: "First" },
					{ id: "b", label: "Second" },
				]}
				indexLabel="Sections"
			>
				<FormSection id="a" step={1} title="First">
					<p>one</p>
				</FormSection>
				<FormSection id="b" step={2} title="Second">
					<p>two</p>
				</FormSection>
				<StickyFormActions summary="Summary line">
					<button type="submit">Save</button>
				</StickyFormActions>
			</GuidedFormLayout>,
		);
		const nav = screen.getByRole("navigation", { name: "Sections" });
		expect(nav.querySelectorAll("a")).toHaveLength(2);
		expect(screen.getByRole("region", { name: "Second" })).toBeTruthy();
		expect(screen.getByText("Summary line")).toBeTruthy();
	});

	it("keeps optional fields inside a collapsed details element", () => {
		const { container } = renderWithProviders(
			<FormDetails title="More options">
				<input aria-label="Extra" />
			</FormDetails>,
		);
		expect(container.querySelector("details")?.open).toBe(false);
	});
});
