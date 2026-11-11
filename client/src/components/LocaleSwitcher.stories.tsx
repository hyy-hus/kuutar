import type { Meta, StoryObj } from "@storybook/tanstack-react";
import LocaleSwitcher from "./LocaleSwitcher";

const meta = {
	title: "Components/LocaleSwitcher",
	component: LocaleSwitcher,
} satisfies Meta<typeof LocaleSwitcher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const FullWidth: Story = {
	args: { fullWidth: true },
	decorators: [
		(Story) => (
			<div className="w-56">
				<Story />
			</div>
		),
	],
};
