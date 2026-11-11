import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { DateInput } from "./DateInput";
import { DateTimeInput } from "./DateTimeInput";

const meta = {
	title: "Components/DateInput",
	component: DateInput,
	args: { "aria-label": "Päivä", defaultValue: "2026-11-11" },
	decorators: [
		(Story) => (
			<div className="max-w-xs">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof DateInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DateOnly: Story = {};
export const DateTime: Story = {
	render: () => (
		<DateTimeInput aria-label="Alkaa" defaultValue="2026-11-11T08:30" />
	),
};
