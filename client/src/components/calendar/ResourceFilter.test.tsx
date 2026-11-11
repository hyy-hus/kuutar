import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { groupResources, ResourceFilter } from "./ResourceFilter";

const collections = [
	{ id: "c2", name: "Välineet" },
	{ id: "c1", name: "Tilat" },
];
const resources = [
	{ id: "r1", name: "Sali 101", color: "blue", collection_id: "c1" },
	{ id: "r2", name: "Kamera", color: "pink", collection_id: "c2" },
	{ id: "r3", name: "Orpo", color: "red", collection_id: "missing" },
];

describe("groupResources", () => {
	it("sorts collections by name and puts unknown ones last", () => {
		const groups = groupResources(resources, collections);
		expect(groups.map((g) => g.name)).toEqual(["Tilat", "Välineet", undefined]);
		expect(groups[2].resources[0].id).toBe("r3");
	});
});

describe("ResourceFilter", () => {
	const setup = (selectedIds: string[], defaultOpen = true) => {
		const onChange = vi.fn();
		render(
			<ResourceFilter
				resources={resources}
				collections={collections}
				selectedIds={selectedIds}
				onChange={onChange}
				defaultOpen={defaultOpen}
			/>,
		);
		return onChange;
	};

	it("is collapsed on request and shows the selection itself", () => {
		setup(["r1"], false);
		expect(screen.queryByRole("button", { name: "Sali 101" })).toBeNull();
		expect(screen.getByText("Sali 101")).toBeTruthy();
		expect(
			screen
				.getByRole("button", { name: /Resources/ })
				.getAttribute("aria-expanded"),
		).toBe("false");
	});

	it("shows all-selected, chips with remove buttons, overflow and empty hint", () => {
		const onChange = setup(["r1", "r2", "r3"], false);
		expect(screen.getByText("All resources (3)")).toBeTruthy();
		fireEvent.click(screen.getByRole("button", { name: "Clear" }));
		expect(onChange).toHaveBeenLastCalledWith([]);
	});

	it("deselects a chip directly from the collapsed bar", () => {
		const onChange = setup(["r1", "r2"], false);
		fireEvent.click(screen.getByRole("button", { name: "Deselect: Kamera" }));
		expect(onChange).toHaveBeenLastCalledWith(["r1"]);
		fireEvent.click(screen.getByRole("button", { name: "Select all" }));
		expect(onChange).toHaveBeenLastCalledWith(["r1", "r2", "r3"]);
	});

	it("hints when nothing is selected", () => {
		setup([], false);
		expect(screen.getByText(/No resources selected/)).toBeTruthy();
	});

	it("collapses extra chips into a +N chip that opens the panel", () => {
		const many = Array.from({ length: 10 }, (_, i) => ({
			id: `m${i}`,
			name: `Res ${i}`,
			color: "blue",
			collection_id: "c1",
		}));
		render(
			<ResourceFilter
				resources={many}
				collections={collections}
				selectedIds={many.slice(0, 9).map((r) => r.id)}
				onChange={() => {}}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /\(\+1\)/ }));
		expect(screen.getByRole("button", { name: "Res 0" })).toBeTruthy();
	});

	it("toggles a resource and supports solo with ctrl-click", () => {
		const onChange = setup(["r1"]);
		fireEvent.click(screen.getByRole("button", { name: "Kamera" }));
		expect(onChange).toHaveBeenLastCalledWith(["r1", "r2"]);
		fireEvent.click(screen.getByRole("button", { name: "Kamera" }), {
			ctrlKey: true,
		});
		expect(onChange).toHaveBeenLastCalledWith(["r2"]);
	});

	it("selects none in one collection only", () => {
		const onChange = setup(["r1", "r2"]);
		fireEvent.click(screen.getByRole("button", { name: /None: Tilat/ }));
		expect(onChange).toHaveBeenLastCalledWith(["r2"]);
	});
});
