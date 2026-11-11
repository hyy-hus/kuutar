import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { ConflictChip } from "./ConflictChip";

const meta = {
	title: "Components/ConflictChip",
	component: ConflictChip,
	args: {
		conflicts: [
			{
				id: "1",
				title: "Kokous",
				resource: "Neuvotteluhuone A",
				time: "12.11.2026 klo 08.00–10.00",
			},
			{
				id: "2",
				title: "Työpaja",
				resource: "Neuvotteluhuone A",
				time: "12.11.2026 klo 09.30–12.00",
			},
		],
	},
} satisfies Meta<typeof ConflictChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: (args) => (
		<div className="p-8">
			<ConflictChip {...args} />
		</div>
	),
};
