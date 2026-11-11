import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { ResourceFilter } from "./ResourceFilter";

const collections = [
	{ id: "c1", name: "Tilat", icon: "building" },
	{ id: "c2", name: "Välineet", icon: "camera" },
];
const resources = [
	{ id: "r1", name: "Sali 101", color: "blue", collection_id: "c1" },
	{ id: "r2", name: "Sali 102", color: "lime", collection_id: "c1" },
	{ id: "r3", name: "Pieni sali", color: "violet", collection_id: "c1" },
	{ id: "r4", name: "Projektori", color: "amber", collection_id: "c2" },
	{ id: "r5", name: "Kamera", color: "#e11d48", collection_id: "c2" },
];

const meta = {
	title: "Calendar/ResourceFilter",
	component: ResourceFilter,
	parameters: { layout: "padded" },
	render: (args) => {
		const [ids, setIds] = useState(["r1", "r4"]);
		return <ResourceFilter {...args} selectedIds={ids} onChange={setIds} />;
	},
	args: {
		resources,
		collections,
		selectedIds: ["r1", "r4"],
		onChange: () => {},
		defaultOpen: true,
	},
} satisfies Meta<typeof ResourceFilter>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {};
export const Collapsed: Story = { args: { defaultOpen: false } };
export const AllSelected: Story = {
	args: { defaultOpen: false },
	render: (args) => {
		const [ids, setIds] = useState(resources.map((r) => r.id));
		return <ResourceFilter {...args} selectedIds={ids} onChange={setIds} />;
	},
};
export const NoneSelected: Story = {
	args: { defaultOpen: false, selectedIds: [] },
	render: (args) => {
		const [ids, setIds] = useState<string[]>([]);
		return <ResourceFilter {...args} selectedIds={ids} onChange={setIds} />;
	},
};
