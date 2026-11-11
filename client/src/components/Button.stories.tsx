import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./Button";

const meta = {
	title: "Components/Button",
	component: Button,
	args: { children: "Tallenna" },
	argTypes: {
		variant: {
			control: "select",
			options: ["default", "outline", "secondary", "ghost", "danger", "field"],
		},
		size: { control: "select", options: ["sm", "md", "lg", "icon", "iconSm"] },
	},
} satisfies Meta<typeof Button>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Outline: Story = { args: { variant: "outline" } };
export const Danger: Story = {
	args: {
		variant: "danger",
		children: (
			<>
				<Trash2 size={16} /> Poista
			</>
		),
	},
};
export const Disabled: Story = { args: { disabled: true } };
export const IconOnly: Story = {
	args: { size: "icon", "aria-label": "Lisää", children: <Plus size={16} /> },
};
