import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Select } from "./Select";

const meta = {
	title: "Components/Select",
	component: Select,
	args: {
		"aria-label": "Kokoelma",
		children: (
			<>
				<option>Kaikki kokoelmat</option>
				<option>Juhlatilat</option>
				<option>Kokoushuoneet</option>
			</>
		),
	},
	decorators: [
		(Story) => (
			<div className="max-w-xs">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Select>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Invalid: Story = { args: { isError: true } };
export const Disabled: Story = { args: { disabled: true } };
