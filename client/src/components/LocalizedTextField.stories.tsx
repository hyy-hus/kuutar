import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import type { LocalizedText } from "#/utils/localizedText";
import { LocalizedTextField } from "./LocalizedTextField";

function Stateful(props: React.ComponentProps<typeof LocalizedTextField>) {
	const [value, setValue] = useState<LocalizedText>(props.value);
	return <LocalizedTextField {...props} value={value} onChange={setValue} />;
}

const meta = {
	title: "Components/LocalizedTextField",
	component: LocalizedTextField,
	render: (args) => <Stateful {...args} />,
	args: {
		label: "Otsikko",
		value: { fi: "Joulun aukioloajat" },
		onChange: () => {},
	},
} satisfies Meta<typeof LocalizedTextField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleLine: Story = { args: { required: true } };

export const Multiline: Story = {
	args: {
		label: "Tiivistelmä",
		multiline: true,
		maxLength: 500,
		value: { fi: "Lyhyt kuvaus, joka näkyy listassa ja etusivulla." },
	},
};

export const WithError: Story = {
	args: { value: {}, required: true, error: "Otsikko on pakollinen" },
};

/** Typing in one language leaves the others alone; tabs mark filled languages */
export const SwitchLanguage: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(canvas.getByRole("tab", { name: "SV" }));
		await userEvent.type(canvas.getByRole("textbox"), "Öppettider");
		await userEvent.click(canvas.getByRole("tab", { name: "FI" }));
		await expect(canvas.getByRole("textbox")).toHaveValue("Joulun aukioloajat");
	},
};
