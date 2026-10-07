import { expect, test } from "@playwright/test";

test("admin session is active", async ({ page }) => {
	await page.goto("/");
	await expect(page.getByRole("button", { name: "User account" })).toBeVisible();
});
