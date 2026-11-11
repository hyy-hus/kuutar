import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { ResourcePicker } from "./ResourcePicker";

const collections = [
	{ id: "c1", name: "Kokoustilat", icon: "presentation" },
	{ id: "c2", name: "Välineet", icon: "camera" },
];
const resources = [
	"Kristallisali",
	"Neuvotteluhuone A",
	"Neuvotteluhuone B",
	"Sali 101",
	"Sali 102",
].map((name, i) => ({
	id: `r${i}`,
	name,
	collection_id: "c1",
	auto_confirm: i % 2 === 0,
	blocks_only: i === 3,
}));
const gear = ["Kamera", "Projektori", "Äänentoisto", "Teltta", "Grilli"].map(
	(name, i) => ({
		id: `g${i}`,
		name,
		collection_id: "c2",
		reservation_restricted: i === 2,
	}),
);

const meta = {
	title: "Components/ResourcePicker",
	component: ResourcePicker,
	args: {
		resources: [...resources, ...gear],
		collections,
		value: [],
		onToggle: () => {},
	},
	render: (args) => {
		const [value, setValue] = useState(args.value);
		return (
			<ResourcePicker
				{...args}
				value={value}
				onToggle={(id) =>
					setValue((v) =>
						v.includes(id) ? v.filter((x) => x !== id) : [...v, id],
					)
				}
			/>
		);
	},
} satisfies Meta<typeof ResourcePicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithSearch: Story = { args: { value: ["r0", "g1"] } };
export const Few: Story = { args: { resources: resources.slice(0, 3) } };
