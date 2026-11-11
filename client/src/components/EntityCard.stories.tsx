import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Lock, Users } from "lucide-react";
import { Chip } from "./Chip";
import { EntityCard } from "./EntityCard";
import { StatusChip } from "./StatusChip";

const meta = {
	title: "Components/EntityCard",
	component: EntityCard,
	args: { to: "/resources", title: "Kristallisali" },
	decorators: [
		(Story) => (
			<div className="max-w-sm">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof EntityCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Minimal: Story = {};

export const Full: Story = {
	args: {
		icon: Users,
		meta: "Kokoelma Juhlatilat · 120 henkilöä",
		description:
			"Valoisa juhlatila kampuksen keskustassa, jossa on äänentoisto, projektori ja keittiö. Soveltuu kokouksiin ja juhliin.",
		badges: (
			<>
				<StatusChip variant="warning" icon={Lock}>
					Rajoitettu varaus
				</StatusChip>
				<Chip>Kuutamo ry</Chip>
			</>
		),
	},
};

export const Grid: Story = {
	render: () => (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
			{["Kristallisali", "Revontulihuone", "Tähtikammio"].map((name) => (
				<EntityCard
					key={name}
					to="/resources"
					title={name}
					icon={Users}
					meta="Juhlatilat"
				/>
			))}
		</div>
	),
};
