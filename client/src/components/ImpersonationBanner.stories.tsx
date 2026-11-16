import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { ImpersonationBanner } from "./ImpersonationBanner";

const meta = {
	title: "Components/ImpersonationBanner",
	component: ImpersonationBanner,
	args: {
		user: { name: "Maija Meikäläinen", email: "maija@example.test" },
		onStop: fn(),
	},
} satisfies Meta<typeof ImpersonationBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

/** An admin acting as a user, with the way back */
export const Default: Story = {
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: /omaan istuntoon/i }),
		);
		await expect(args.onStop).toHaveBeenCalled();
	},
};

/** While returning to the admin's session */
export const Stopping: Story = {
	args: { stopping: true },
};
