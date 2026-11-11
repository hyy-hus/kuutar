import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BackLink } from "./BackLink";
import { Button } from "./Button";
import { DetailLayout } from "./DetailLayout";
import { StatusChip } from "./StatusChip";

const meta = {
	title: "Layout/DetailLayout",
	component: DetailLayout,
	parameters: { layout: "fullscreen" },
	args: {
		title: "Kristallisali",
		back: <BackLink to="/resources">Takaisin resursseihin</BackLink>,
		status: <StatusChip variant="success">Aktiivinen</StatusChip>,
		actions: <Button variant="outline">Muokkaa</Button>,
		children: (
			<section className="rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
				Sisältö
			</section>
		),
		dangerZone: <Button variant="danger-outline">Poista resurssi</Button>,
		technical: {
			id: "6f1c3a9e-5a2b-4a60-9d6e-0a1b2c3d4e5f",
			createdAt: "2026-09-01T09:00:00Z",
			updatedAt: "2026-10-12T14:30:00Z",
		},
	},
} satisfies Meta<typeof DetailLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithoutDangerOrTechnical: Story = {
	args: { dangerZone: undefined, technical: undefined },
};
