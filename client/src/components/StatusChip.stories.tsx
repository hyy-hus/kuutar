import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Check, Clock, X } from "lucide-react";
import { StatusChip } from "./StatusChip";

const meta = {
	title: "Components/StatusChip",
	component: StatusChip,
	args: { children: "Odottaa hyväksyntää" },
	argTypes: {
		variant: {
			control: "select",
			options: ["neutral", "success", "warning", "danger", "info"],
		},
	},
} satisfies Meta<typeof StatusChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AllVariants: Story = {
	render: () => (
		<div className="flex flex-wrap gap-2">
			<StatusChip icon={Clock} variant="warning">
				Odottaa
			</StatusChip>
			<StatusChip icon={Check} variant="success">
				Vahvistettu
			</StatusChip>
			<StatusChip icon={X} variant="danger">
				Peruttu
			</StatusChip>
			<StatusChip variant="neutral">Tulossa</StatusChip>
			<StatusChip variant="info">Päivitetty</StatusChip>
		</div>
	),
};
