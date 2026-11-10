import { expect, test } from "@playwright/test";

// datetime-local value `days` from now, on the hour
function localDateTime(days: number): string {
	const d = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
	d.setMinutes(0, 0, 0);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

test("admin creates a reservation round for a block-based resource", async ({
	page,
}) => {
	const suffix = Date.now();

	await page.goto("/collections/create");
	await page.getByLabel("Collection Name").fill(`Rounds ${suffix}`);
	await page.getByRole("button", { name: "Create collection" }).click();
	await expect(page).toHaveURL(/\/collections\/[0-9a-f-]+$/);

	await page.goto("/admin/groups/create");
	await page.getByLabel("Group Name").fill(`Applicants ${suffix}`);
	await page.getByRole("button", { name: "Create group" }).click();
	await expect(page).toHaveURL(/\/admin\/groups\/[0-9a-f-]+$/);

	await page.goto("/resources/create");
	await page.getByLabel("Resource Name").fill(`Sauna ${suffix}`);
	await page
		.getByLabel("Collection", { exact: true })
		.selectOption({ label: `Rounds ${suffix}` });
	await page.getByLabel(/only in blocks defined by an admin/i).check();
	await page.getByRole("button", { name: "Create resource" }).click();
	await expect(page).toHaveURL(/\/resources\/[0-9a-f-]+$/);

	await page.goto("/admin/rounds/create");
	await page.getByLabel("Name", { exact: true }).fill(`Round ${suffix}`);
	await page.getByLabel("Applications open").fill(localDateTime(1));
	await page.getByLabel("Applications close").fill(localDateTime(3));
	await page.getByLabel("Bookable period starts").fill(localDateTime(7));
	await page.getByLabel("Bookable period ends").fill(localDateTime(37));
	await page.getByLabel(`Sauna ${suffix}`).check();
	await page.getByLabel(`Applicants ${suffix}`).check();
	await page.getByRole("button", { name: "Create round" }).click();

	await expect(page).toHaveURL(/\/admin\/rounds\/[0-9a-f-]+$/);
	await expect(
		page.getByRole("heading", { name: `Round ${suffix}` }),
	).toBeVisible();
	await expect(page.getByText("Upcoming")).toBeVisible();
	await expect(page.getByText("No applications.")).toBeVisible();

	// Rounds that have not started can be edited
	await page.getByRole("link", { name: "Edit round" }).click();
	await page.getByLabel("Name", { exact: true }).fill(`Renamed ${suffix}`);
	await page.getByRole("button", { name: "Save" }).click();
	await expect(
		page.getByRole("heading", { name: `Renamed ${suffix}` }),
	).toBeVisible();

	await page.goto("/admin/rounds");
	await expect(
		page.getByRole("heading", { name: `Renamed ${suffix}` }),
	).toBeVisible();
});
