import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { HttpResponse, http } from "msw";
import { expect, userEvent, within } from "storybook/test";
import { makeReservation, makeResource } from "#/test/fixtures";
import { SearchBar } from "./SearchBar";

const resources = [
	makeResource({ name: "Kristallisali" }),
	makeResource({ name: "Kristallikruunu-sali" }),
	makeResource({ name: "Teltta" }),
];
const reservations = [
	makeReservation({ title: "Kristallijuhla" }),
	makeReservation({ title: "Hallituksen kokous" }),
];

const meta = {
	title: "Components/SearchBar",
	component: SearchBar,
	beforeEach({ msw }) {
		msw.use(
			http.get("*/resources", () => HttpResponse.json(resources)),
			http.get("*/reservations", () => HttpResponse.json(reservations)),
		);
	},
} satisfies Meta<typeof SearchBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

/** Typing lists matching resources and reservations from the (mocked) API */
export const WithResults: Story = {
	play: async ({ canvasElement }) => {
		const canvas = within(canvasElement);
		await userEvent.type(canvas.getByRole("textbox"), "kristalli");
		await expect(
			await within(document.body).findByText("Kristallisali"),
		).toBeInTheDocument();
	},
};
