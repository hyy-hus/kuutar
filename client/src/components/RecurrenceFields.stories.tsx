import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { NO_RECURRENCE, type RRuleConfig } from "#/utils/rruleUtils";
import { RecurrenceFields } from "./RecurrenceFields";

function Stateful({
	initial,
	startTime,
}: {
	initial: RRuleConfig;
	startTime: string;
}) {
	const [value, setValue] = useState(initial);
	return (
		<div className="max-w-md">
			<RecurrenceFields
				startTime={startTime}
				value={value}
				onChange={setValue}
			/>
		</div>
	);
}

const meta = {
	title: "Forms/RecurrenceFields",
	component: Stateful,
	args: { startTime: "2026-11-11T17:00", initial: NO_RECURRENCE },
} satisfies Meta<typeof Stateful>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoRepeat: Story = {};
export const WeeklyFourTimes: Story = {
	args: {
		initial: { ...NO_RECURRENCE, freq: "weekly", weekdays: [3], count: 4 },
	},
};
