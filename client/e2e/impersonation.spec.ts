import { expect, test } from "@playwright/test";

const API_URL = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3100"}`;

test("admin acts as a user and returns to their own session", async ({
	page,
	request,
}) => {
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
	const login = await request.post(`${API_URL}/auth/login`, {
		data: { email: "admin@localhost", password: "Admin" },
	});
	expect(login.ok()).toBe(true);
	const { access_token } = await login.json();
	const headers = { Authorization: `Bearer ${access_token}` };

	const group = await (
		await request.post(`${API_URL}/groups`, {
			headers,
			data: { name: `Group ${suffix}` },
		})
	).json();
	const name = `Member ${suffix}`;
	const email = `member-${suffix}@example.com`;
	const created = await request.post(`${API_URL}/users`, {
		headers,
		data: {
			group_id: group.id,
			name,
			email,
			password: "member-password",
			language: "en",
		},
	});
	expect(created.ok(), await created.text()).toBe(true);
	const user = await created.json();

	await page.goto(`/admin/users/${user.id}`);
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "Act as user" }).click();

	// The user's own view, with the banner saying whose session this is
	await expect(page).toHaveURL(/\/$/);
	await expect(
		page.getByText(`You are acting as ${name} (${email}).`),
	).toBeVisible();
	await expect(page.getByRole("link", { name: "Users" })).toHaveCount(0);

	// The profile page hides the credentials and sessions
	await page.goto("/me");
	// The first "Email" is the account email; the contact email below has the same label
	await expect(page.getByLabel("Email", { exact: true }).first()).toBeDisabled();
	await expect(page.getByText("Sessions", { exact: true })).toHaveCount(0);

	await page.getByRole("button", { name: "Return to your own session" }).click();
	await expect(page).toHaveURL(new RegExp(`/admin/users/${user.id}$`));
	await expect(page.getByText(/You are acting as/)).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Act as user" })).toBeVisible();
});
