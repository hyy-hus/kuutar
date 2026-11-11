import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { ResourcePicker } from "./ResourcePicker";

const collections = [
	{ id: "c1", name: "Rooms" },
	{ id: "c2", name: "Gear" },
];
const resources = [
	{
		id: "c",
		name: "Camera",
		collection_id: "c2",
		reservation_restricted: true,
	},
	{ id: "a", name: "Alpha", collection_id: "c1", auto_confirm: true },
	{ id: "b", name: "Beta", collection_id: "c1" },
];

describe("ResourcePicker", () => {
	it("shows one chip per resource, ordered by collection, and toggles", async () => {
		const onToggle = vi.fn();
		renderWithProviders(
			<ResourcePicker
				resources={resources}
				collections={collections}
				value={[]}
				onToggle={onToggle}
			/>,
		);
		const names = screen
			.getAllByRole("button")
			.map((b) => b.textContent?.trim());
		expect(names).toEqual(["Alpha", "Beta", "Camera"]);
		expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Beta" }));
		expect(onToggle).toHaveBeenCalledWith("b");
	});

	it("marks selected chips and puts hints in the tooltip", () => {
		renderWithProviders(
			<ResourcePicker
				resources={resources}
				collections={collections}
				value={["a"]}
				onToggle={() => {}}
			/>,
		);
		const alpha = screen.getByRole("button", { name: "Alpha" });
		expect(alpha).toHaveAttribute("aria-pressed", "true");
		expect(alpha).toHaveAttribute("title", "Confirmed automatically");
		expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
			"aria-pressed",
			"false",
		);
	});

	it("filters with the search above the threshold but keeps selected chips", async () => {
		renderWithProviders(
			<ResourcePicker
				resources={resources}
				collections={collections}
				value={["a"]}
				onToggle={() => {}}
				searchThreshold={2}
			/>,
		);
		await userEvent.type(screen.getByRole("searchbox"), "cam");
		expect(screen.getByRole("button", { name: "Camera" })).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Alpha" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Beta" })).toBeNull();
	});

	it("says so when nothing matches", async () => {
		renderWithProviders(
			<ResourcePicker
				resources={resources}
				collections={collections}
				value={[]}
				onToggle={() => {}}
				searchThreshold={2}
			/>,
		);
		await userEvent.type(screen.getByRole("searchbox"), "zzz");
		expect(screen.getByText("No results")).toBeInTheDocument();
	});
});
