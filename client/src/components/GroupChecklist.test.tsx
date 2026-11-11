import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Group } from "#/hooks/useGroups";
import { renderWithProviders } from "#/test/render";
import { GroupChecklist } from "./GroupChecklist";

const NOW = "2026-11-11T09:00:00.000Z";
const makeGroups = (n: number): Group[] =>
	Array.from({ length: n }, (_, i) => ({
		id: `g${i}`,
		name: `Group ${i}`,
		created_at: NOW,
		updated_at: NOW,
	}));

describe("GroupChecklist", () => {
	it("has no search field for short lists", () => {
		renderWithProviders(
			<GroupChecklist groups={makeGroups(3)} value={[]} onChange={vi.fn()} />,
		);
		expect(screen.queryByRole("searchbox")).toBeNull();
	});

	it("filters long lists and toggles values", async () => {
		const onChange = vi.fn();
		renderWithProviders(
			<GroupChecklist
				groups={makeGroups(12)}
				value={["g1"]}
				onChange={onChange}
			/>,
		);
		await userEvent.type(screen.getByRole("searchbox"), "group 11");
		expect(screen.getAllByRole("checkbox")).toHaveLength(1);
		await userEvent.click(screen.getByRole("checkbox", { name: "Group 11" }));
		expect(onChange).toHaveBeenLastCalledWith(["g1", "g11"]);
	});
});
