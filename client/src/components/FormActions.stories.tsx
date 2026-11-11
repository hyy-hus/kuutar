import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Button } from "./Button";
import { FormActions } from "./FormActions";

const meta = {
	title: "Components/FormActions",
	component: FormActions,
	args: { children: <Button>Tallenna</Button>, onCancel: () => {} },
} satisfies Meta<typeof FormActions>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const DisabledWithHint: Story = {
	args: {
		children: <Button disabled>Tallenna</Button>,
		hint: "Valitse vähintään yksi resurssi.",
	},
};
