import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { GroupChecklist } from "./GroupChecklist";

const NOW = "2026-11-11T09:00:00.000Z";
const groups = Array.from({ length: 24 }, (_, i) => ({
	id: `g${i}`,
	name: `Tähtiryhmä ${i + 1}`,
	created_at: NOW,
	updated_at: NOW,
}));

const meta = {
	title: "Components/GroupChecklist",
	component: GroupChecklist,
	args: { groups, value: [], onChange: () => {} },
} satisfies Meta<typeof GroupChecklist>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Long: Story = {
	render: (args) => {
		const [value, setValue] = useState<string[]>(["g2"]);
		return <GroupChecklist {...args} value={value} onChange={setValue} />;
	},
};

export const Short: Story = {
	render: (args) => {
		const [value, setValue] = useState<string[]>([]);
		return (
			<GroupChecklist
				{...args}
				groups={groups.slice(0, 4)}
				value={value}
				onChange={setValue}
			/>
		);
	},
};
