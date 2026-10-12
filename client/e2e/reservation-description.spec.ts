import { expect, test } from "@playwright/test";

test("the reservation form warns that the description is public", async ({
	page,
}) => {
	await page.goto("/reservations/create");

	await expect(
		page.getByText("The description is public and visible to everyone.", {
			exact: false,
		}),
	).toBeVisible();

	// The private field is separate from the public description, with its own editor tabs
	const message = page.getByLabel("Message to administrators");
	await expect(message).toBeVisible();
	await message.fill("Please set up the projector");
	await expect(message).toHaveValue("Please set up the projector");
	await expect(
		page.getByText("Only you and the administrators can see this."),
	).toBeVisible();
});
