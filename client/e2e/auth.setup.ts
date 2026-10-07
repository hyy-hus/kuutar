import { expect, test as setup } from "@playwright/test";

const AUTH_FILE = "e2e/.auth/admin.json";

// Logs in once as the seeded admin and saves the session for the other tests
setup("sign in as admin", async ({ page }) => {
	await page.goto("/");
	await page.getByRole("button", { name: "Log In", exact: true }).click();
	// The dialog opens on the email-code form; switch to password sign-in
	await page.getByRole("button", { name: "Sign in with password" }).click();
	await page.getByLabel("Email").fill("admin@localhost");
	await page.getByLabel("Password").fill("Admin");
	await page.getByRole("button", { name: "Log In", exact: true }).click();
	await expect(page.getByRole("button", { name: "User account" })).toBeVisible();
	await page.context().storageState({ path: AUTH_FILE });
});
