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
	{ id: "a", name: "Alpha", collection_id: "c1", auto_confirm: true },
	{ id: "b", name: "Beta", collection_id: "c1" },
	{
		id: "c",
		name: "Camera",
		collection_id: "c2",
		reservation_restricted: true,
	},
];

describe("ResourcePicker", () => {
	it("groups by collection, shows hints and toggles", async () => {
		const onToggle = vi.fn();
		renderWithProviders(
			<ResourcePicker
				resources={resources}
				collections={collections}
				value={[]}
				onToggle={onToggle}
			/>,
		);
		expect(screen.getByRole("group", { name: "Rooms" })).toBeInTheDocument();
		expect(screen.getByRole("group", { name: "Gear" })).toBeInTheDocument();
		expect(screen.getByText(/Confirmed automatically/)).toBeInTheDocument();
		expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
		await userEvent.click(screen.getByRole("checkbox", { name: /Beta/ }));
		expect(onToggle).toHaveBeenCalledWith("b");
	});

	it("shows selected resources as removable chips", async () => {
		const onToggle = vi.fn();
		renderWithProviders(
			<ResourcePicker
				resources={resources}
				collections={collections}
				value={["a"]}
				onToggle={onToggle}
			/>,
		);
		expect(screen.getByRole("checkbox", { name: /Alpha/ })).toBeChecked();
		await userEvent.click(screen.getByRole("button", { name: /Alpha/ }));
		expect(onToggle).toHaveBeenCalledWith("a");
	});

	it("shows an empty hint and filters with the search above the threshold", async () => {
		renderWithProviders(
			<ResourcePicker
				resources={resources}
				collections={collections}
				value={[]}
				onToggle={() => {}}
				searchThreshold={2}
			/>,
		);
		expect(screen.getByText("No resources selected")).toBeInTheDocument();
		await userEvent.type(screen.getByRole("searchbox"), "cam");
		expect(screen.queryByRole("checkbox", { name: /Alpha/ })).toBeNull();
		expect(
			screen.getByRole("checkbox", { name: /Camera/ }),
		).toBeInTheDocument();
	});
});
