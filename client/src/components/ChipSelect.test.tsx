import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChipSelect } from "./ChipSelect";

const options = [
	{ value: "a", label: "Alpha" },
	{ value: "b", label: "Beta" },
];

describe("ChipSelect", () => {
	it("adds and removes values", async () => {
		const onChange = vi.fn();
		const { rerender } = render(
			<ChipSelect
				aria-label="Rooms"
				options={options}
				value={["a"]}
				onChange={onChange}
			/>,
		);
		expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: "Beta" }));
		expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);

		rerender(
			<ChipSelect
				aria-label="Rooms"
				options={options}
				value={["a", "b"]}
				onChange={onChange}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: "Alpha" }));
		expect(onChange).toHaveBeenLastCalledWith(["b"]);
	});
});
