import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { expect, fn, userEvent, within } from "storybook/test";
import { makeNews } from "#/test/fixtures";
import { HighlightedNews } from "./HighlightedNews";

const items = [
	makeNews({
		title: { fi: "Joulun aukioloajat", en: "Opening hours over Christmas" },
		blurb: {
			fi: "Tilat ovat kiinni 24.–26.12. Varaukset näille päiville perutaan.",
			en: "The spaces are closed on 24–26 December.",
		},
		highlighted: true,
	}),
	makeNews({
		title: { fi: "Kevään varauskierros avautuu" },
		blurb: { fi: "Hae vakiovuoroja kevääksi 1.12. mennessä." },
		highlighted: true,
	}),
];

const meta = {
	title: "Components/HighlightedNews",
	component: HighlightedNews,
	args: { items },
} satisfies Meta<typeof HighlightedNews>;
export default meta;
type Story = StoryObj<typeof meta>;

/** What guests see: no dismiss button, since their reads are not tracked */
export const Guest: Story = {};

export const SignedIn: Story = {
	args: { onDismiss: fn() },
	play: async ({ args, canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.click(
			canvas.getByRole("button", { name: /Joulun aukioloajat/ }),
		);
		await expect(args.onDismiss).toHaveBeenCalledWith(items[0].id);
	},
};

export const Single: Story = { args: { items: items.slice(0, 1) } };

export const Empty: Story = { args: { items: [] } };
