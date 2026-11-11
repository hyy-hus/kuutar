import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import type { PeriodMonths } from "#/utils/period";
import { FilterBar } from "./FilterBar";
import { PeriodNavigator } from "./PeriodNavigator";

const meta = {
	title: "Components/PeriodNavigator",
	component: PeriodNavigator,
	args: { start: new Date(2026, 10, 1), months: 1, onChange: () => {} },
} satisfies Meta<typeof PeriodNavigator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InFilterBar: Story = {
	render: () => {
		const [months, setMonths] = useState<PeriodMonths>(3);
		return (
			<FilterBar>
				<PeriodNavigator
					start={new Date(2026, 10, 1)}
					months={months}
					onChange={(next) => next.months && setMonths(next.months)}
				/>
			</FilterBar>
		);
	},
};
