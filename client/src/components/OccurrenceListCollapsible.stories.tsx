import type { Meta, StoryObj } from "@storybook/tanstack-react";
import {
	OccurrenceListCollapsible,
	type OccurrenceListItem,
} from "./OccurrenceListCollapsible";

const makeItems = (count: number, groupLabel: string): OccurrenceListItem[] =>
	Array.from({ length: count }, (_, i) => ({
		id: `${groupLabel}-${i}`,
		start_time: new Date(2026, 10, 1 + i * 7, 17).toISOString(),
		end_time: new Date(2026, 10, 1 + i * 7, 20).toISOString(),
		groupLabel,
		reserved: i === 1,
		canDetach: i > 0,
	}));

const meta = {
	title: "Lists/OccurrenceListCollapsible",
	component: OccurrenceListCollapsible,
	args: { items: makeItems(12, "Sauna"), onDetach: async () => {} },
} satisfies Meta<typeof OccurrenceListCollapsible>;
export default meta;

type Story = StoryObj<typeof meta>;

export const SingleGroup: Story = {};

export const MultipleGroups: Story = {
	args: { items: [...makeItems(8, "Sauna"), ...makeItems(3, "Club room")] },
};
