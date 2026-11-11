import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { BackLink } from "./BackLink";

const meta = {
	title: "Components/BackLink",
	component: BackLink,
	args: { to: "/resources", children: "Takaisin resursseihin" },
} satisfies Meta<typeof BackLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
