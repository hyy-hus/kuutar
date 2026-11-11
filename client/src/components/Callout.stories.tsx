import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Button } from "./Button";
import { Callout } from "./Callout";

const meta = {
	title: "Components/Callout",
	component: Callout,
	args: { children: "Resurssi vahvistuu automaattisesti." },
	argTypes: {
		variant: {
			control: "select",
			options: ["info", "warning", "danger", "success"],
		},
	},
} satisfies Meta<typeof Callout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Info: Story = {};

export const WithTitleAndAction: Story = {
	args: {
		variant: "warning",
		title: "3 varausta odottaa hyväksyntää",
		children: "Vanhin on odottanut viikon.",
		action: <Button size="sm">Avaa hyväksynnät</Button>,
	},
};

export const AllVariants: Story = {
	render: () => (
		<div className="space-y-3">
			<Callout variant="info">Tiedoksi.</Callout>
			<Callout variant="warning">Varoitus.</Callout>
			<Callout variant="danger">Virhe.</Callout>
			<Callout variant="success">Onnistui.</Callout>
		</div>
	),
};
