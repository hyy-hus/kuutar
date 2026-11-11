import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { PageContainer } from "./PageContainer";

const meta = {
	title: "Layout/PageContainer",
	component: PageContainer,
	args: { children: <div className="bg-stone-200 p-4">Sisältö</div> },
	argTypes: {
		width: { control: "select", options: ["wide", "default", "narrow"] },
	},
} satisfies Meta<typeof PageContainer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Wide: Story = { args: { width: "wide" } };
export const Default: Story = { args: { width: "default" } };
export const Narrow: Story = { args: { width: "narrow" } };
