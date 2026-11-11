import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { PeriodEmptyState } from "./PeriodEmptyState";

const meta = {
	title: "Components/PeriodEmptyState",
	component: PeriodEmptyState,
	args: {
		start: new Date(2026, 10, 1),
		months: 1,
		what: "varauksia",
		onChange: () => {},
	},
} satisfies Meta<typeof PeriodEmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OneMonth: Story = {};
export const LongestPeriod: Story = {
	args: { start: new Date(2026, 0, 1), months: 12 },
};
