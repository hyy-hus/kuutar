import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { DetachOccurrenceButton } from "./DetachOccurrenceButton";
import { OccurrenceList } from "./OccurrenceList";

const weekly = (resourceId: string, count: number) =>
	Array.from({ length: count }, (_, i) => {
		const day = new Date(Date.UTC(2026, 10, 12 + i * 7, 8, 0));
		return {
			id: `${resourceId}-${i}`,
			resource_id: resourceId,
			start_time: day.toISOString(),
			end_time: new Date(day.getTime() + 3 * 3600_000).toISOString(),
		};
	});

const meta = {
	title: "Components/OccurrenceList",
	component: OccurrenceList,
	args: {
		occurrences: weekly("r1", 3),
		resourceNames: { r1: "Kristallisali", r2: "Revontulihuone" },
	},
} satisfies Meta<typeof OccurrenceList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Short: Story = {};

export const GroupedAndCollapsed: Story = {
	args: { occurrences: [...weekly("r1", 8), ...weekly("r2", 2)] },
};

export const WithDetachAction: Story = {
	args: {
		occurrences: weekly("r1", 7),
		renderAction: () => <DetachOccurrenceButton onDetach={async () => {}} />,
	},
};
