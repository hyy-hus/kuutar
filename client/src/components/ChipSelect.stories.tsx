import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { ChipSelect } from "./ChipSelect";

const meta = {
	title: "Components/ChipSelect",
	component: ChipSelect,
	args: {
		options: [],
		value: [],
		onChange: () => {},
		"aria-label": "Resurssit",
	},
} satisfies Meta<typeof ChipSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [value, setValue] = useState(["a"]);
		return (
			<ChipSelect
				aria-label="Resurssit"
				value={value}
				onChange={setValue}
				options={[
					{ value: "a", label: "Kristallisali" },
					{ value: "b", label: "Revontulihuone" },
					{ value: "c", label: "Tähtikammio" },
				]}
			/>
		);
	},
};
