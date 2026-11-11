import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Chip, ToggleChip } from "./Chip";

const meta = {
	title: "Components/Chip",
	component: Chip,
	args: { children: "Kristallisali" },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Toggles: Story = {
	render: () => (
		<div className="flex gap-2">
			<ToggleChip selected>Kaikki</ToggleChip>
			<ToggleChip>Kuutamo ry</ToggleChip>
			<ToggleChip>Revontuli ry</ToggleChip>
		</div>
	),
};
