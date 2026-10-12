import { expect, test } from "@playwright/test";

test("admin limits a resource's visibility to selected groups", async ({
	page,
}) => {
	const suffix = Date.now();

	await page.goto("/collections/create");
	await page.getByLabel("Collection Name").fill(`Visibility ${suffix}`);
	await page.getByRole("button", { name: "Create collection" }).click();
	await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);

	await page.goto("/resources/create");
	await page.getByLabel("Resource Name").fill(`Hidden room ${suffix}`);
	await page.getByLabel("Collection", { exact: true }).selectOption({
		label: `Visibility ${suffix}`,
	});

	// Public by default; choosing groups with none selected leaves admins only
	const summary = page.getByRole("term").filter({ hasText: "Can see" });
	await expect(summary.locator("xpath=following-sibling::dd[1]")).toHaveText(
		"Everyone, including logged-out visitors",
	);
	await page.getByLabel("Selected groups only").check();
	await expect(summary.locator("xpath=following-sibling::dd[1]")).toHaveText(
		"Admins only",
	);

	await page.getByRole("button", { name: "Create resource" }).click();
	await expect(page).toHaveURL(/\/resources\/[0-9a-f-]+$/);
	await expect(
		page.getByRole("heading", { name: `Hidden room ${suffix}` }),
	).toBeVisible();

	// The list marks the resource as having limited visibility
	await page.goto("/resources");
	const card = page.getByRole("listitem").filter({
		hasText: `Hidden room ${suffix}`,
	});
	await expect(card.getByText("Limited visibility")).toBeVisible();
});
