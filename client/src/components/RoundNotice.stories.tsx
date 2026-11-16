import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, within } from "storybook/test";
import { makeRound } from "#/test/fixtures";
import { RoundNotice } from "./RoundNotice";

const round = makeRound({ name: "Kevään varauskierros" });

const meta = {
	title: "Components/RoundNotice",
	component: RoundNotice,
	args: { round, now: new Date("2026-11-11T09:00:00Z") },
} satisfies Meta<typeof RoundNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Applications open: says what to do and links straight to the form */
export const Open: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await expect(
			canvas.getByRole("link", { name: /varausjaksoa/i }),
		).toBeVisible();
	},
};

/** Before the window opens: dates only, no apply button */
export const Upcoming: Story = {
	args: { now: new Date("2026-11-01T09:00:00Z") },
};

/** Window closed, allocation not yet done */
export const Allocating: Story = {
	args: { now: new Date("2026-11-20T09:00:00Z") },
};
