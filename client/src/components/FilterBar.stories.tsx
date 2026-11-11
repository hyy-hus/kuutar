import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import type { PeriodMonths } from "#/utils/period";
import { Button } from "./Button";
import { FilterBar } from "./FilterBar";
import { PeriodNavigator } from "./PeriodNavigator";
import { Select } from "./Select";

const meta = {
	title: "Components/FilterBar",
	component: FilterBar,
	args: { children: null },
} satisfies Meta<typeof FilterBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithPeriodNavigator: Story = {
	render: () => {
		const [start, setStart] = useState(new Date(2026, 10, 1));
		const [months, setMonths] = useState<PeriodMonths>(1);
		return (
			<FilterBar actions={<Button size="sm">Uusi rajoitus</Button>}>
				<PeriodNavigator
					start={start}
					months={months}
					onChange={(next) => {
						if (next.months) setMonths(next.months);
						if (next.start_date) {
							const [y, m, d] = next.start_date.split("-").map(Number);
							setStart(new Date(y, m - 1, d));
						}
					}}
				/>
				<Select size="sm" wrapperClassName="w-auto" aria-label="Resurssi">
					<option>Kaikki resurssit</option>
					<option>Kristallisali</option>
				</Select>
			</FilterBar>
		);
	},
};
