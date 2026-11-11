import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LocaleTabs } from "./LocaleTabs";

describe("LocaleTabs", () => {
	it("lists languages in the order FI, SV, EN and marks the selected one", () => {
		render(
			<LocaleTabs
				value="sv"
				onChange={() => {}}
				languages={["en", "fi", "sv"]}
			/>,
		);
		const tabs = screen.getAllByRole("tab");
		expect(tabs.map((t) => t.textContent)).toEqual(["FI", "SV", "EN"]);
		expect(screen.getByRole("tab", { name: "SV" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});

	it("reports the clicked language", async () => {
		const onChange = vi.fn();
		render(<LocaleTabs value="fi" onChange={onChange} />);
		await userEvent.click(screen.getByRole("tab", { name: "EN" }));
		expect(onChange).toHaveBeenCalledWith("en");
	});
});
