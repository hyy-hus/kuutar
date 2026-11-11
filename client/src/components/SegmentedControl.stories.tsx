import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { SegmentedControl } from "./SegmentedControl";

const meta = {
	title: "Components/SegmentedControl",
	component: SegmentedControl,
	args: { options: [], value: "", onChange: () => {}, "aria-label": "Näkymä" },
} satisfies Meta<typeof SegmentedControl>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [view, setView] = useState("days");
		return (
			<SegmentedControl
				aria-label="Näkymä"
				value={view}
				onChange={setView}
				options={[
					{ value: "days", label: "Päivät" },
					{ value: "month", label: "Kuukausi" },
				]}
			/>
		);
	},
};

export const ThreeOptions: Story = {
	render: () => {
		const [range, setRange] = useState("30");
		return (
			<SegmentedControl
				aria-label="Jakso"
				value={range}
				onChange={setRange}
				options={[
					{ value: "30", label: "30 pv" },
					{ value: "90", label: "90 pv" },
					{ value: "365", label: "12 kk" },
				]}
			/>
		);
	},
};
