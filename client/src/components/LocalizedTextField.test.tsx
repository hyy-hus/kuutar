import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { LocalizedText } from "#/utils/localizedText";
import { LocalizedTextField } from "./LocalizedTextField";

function Harness({
	initial = {},
	onChange,
}: {
	initial?: LocalizedText;
	onChange?: (value: LocalizedText) => void;
}) {
	const [value, setValue] = useState(initial);
	return (
		<LocalizedTextField
			label="Title"
			value={value}
			onChange={(next) => {
				setValue(next);
				onChange?.(next);
			}}
		/>
	);
}

describe("LocalizedTextField", () => {
	it("starts on the UI language and edits that language only", async () => {
		const onChange = vi.fn();
		render(<Harness initial={{ fi: "Otsikko" }} onChange={onChange} />);
		expect(screen.getByRole("tab", { name: "EN" })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		await userEvent.type(
			screen.getByRole("textbox", { name: "Title (EN)" }),
			"Hi",
		);
		expect(onChange).toHaveBeenLastCalledWith({ fi: "Otsikko", en: "Hi" });
	});

	it("switches language with the tabs and shows that language's text", async () => {
		render(<Harness initial={{ fi: "Otsikko" }} />);
		await userEvent.click(screen.getByRole("tab", { name: "FI" }));
		expect(screen.getByRole("textbox", { name: "Title (FI)" })).toHaveValue(
			"Otsikko",
		);
	});

	it("shows an error under the field", () => {
		render(
			<LocalizedTextField
				label="Title"
				value={{}}
				onChange={() => {}}
				error="Title is required"
			/>,
		);
		expect(screen.getByRole("textbox")).toHaveAccessibleDescription(
			"Title is required",
		);
	});
});
