import { expect, test } from "@playwright/test";

test("the reservation form says who sees the title and description", async ({
	page,
}) => {
	await page.goto("/reservations/create");

	await expect(
		page.getByText("The title and description are shown to everyone in the calendar", {
			exact: false,
		}),
	).toBeVisible();

	// The private field is separate from the public description, with its own editor tabs
	const message = page.getByLabel("Message to administrators");
	await expect(message).toBeVisible();
	await message.fill("Please set up the projector");
	await expect(message).toHaveValue("Please set up the projector");
	await expect(
		page.getByText("Only admins see this, not the calendar."),
	).toBeVisible();
});
