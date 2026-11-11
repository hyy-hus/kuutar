import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Textarea } from "./Textarea";

const meta = {
	title: "Components/Textarea",
	component: Textarea,
	args: { "aria-label": "Kuvaus", placeholder: "Kirjoita kuvaus..." },
	decorators: [
		(Story) => (
			<div className="max-w-md">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { isError: true } };
