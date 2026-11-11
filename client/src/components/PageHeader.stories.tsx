import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BackLink } from "./BackLink";
import { Button } from "./Button";
import { PageHeader } from "./PageHeader";
import { StatusChip } from "./StatusChip";

const meta = {
	title: "Layout/PageHeader",
	component: PageHeader,
	args: { title: "Resurssit" },
} satisfies Meta<typeof PageHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ListPage: Story = {
	args: {
		subtitle: "16 resurssia",
		actions: <Button>Uusi resurssi</Button>,
	},
};

export const DetailPage: Story = {
	args: {
		title: "Kristallisali",
		back: <BackLink to="/resources">Takaisin resursseihin</BackLink>,
		status: <StatusChip variant="success">Vahvistettu</StatusChip>,
		actions: (
			<>
				<Button>Varaa</Button>
				<Button variant="outline">Muokkaa</Button>
			</>
		),
	},
};
