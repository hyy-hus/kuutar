import { expect, test } from "@playwright/test";

test("admin creates a weekday series, excludes a date and detaches one occurrence", async ({
	page,
}) => {
	const title = `Weekday closure ${Date.now()}`;

	await page.goto("/restrictions/create");
	await page.getByLabel("Restriction title / reason").fill(title);
	// A Monday far enough ahead to be in the future whenever this runs
	await page.getByLabel("Start Time").fill("2037-01-05T18:00");
	await page.getByLabel("End time").fill("2037-01-05T19:00");

	await page
		.getByLabel("Recurrence Interval")
		.selectOption({ label: "Weekly on selected days" });
	// Starts on the day of the start date; one click picks Monday to Friday
	await expect(page.getByLabel("Mon", { exact: true })).toBeChecked();
	await page.getByRole("button", { name: "Weekdays Mon–Fri" }).click();
	await page.getByLabel("Sat", { exact: true }).check();
	await page.getByLabel("Sat", { exact: true }).uncheck();
	await page
		.getByLabel("Recurrence Ends")
		.selectOption({ label: "After a number of times" });
	await page.getByLabel("Number of occurrences").fill("5");

	// Monday to Friday are listed; skip Wednesday
	await page.getByText("Exceptions", { exact: true }).click();
	const dates = page.locator('input[id^="recurrence_occ_"]');
	await expect(dates).toHaveCount(5);
	await dates.nth(2).uncheck();
	await expect(page.getByText("Exceptions (1)")).toBeVisible();

	await page.getByRole("button", { name: "Create time restriction" }).click();
	await expect(page).toHaveURL(/\/restrictions\/[0-9a-f-]+$/);
	await expect(page.getByText("Restricted periods (4)")).toBeVisible();

	// Detach the second occurrence from the series
	page.once("dialog", (dialog) => dialog.accept());
	await page
		.getByRole("button", { name: "Detach from series" })
		.nth(1)
		.click();
	await expect(page).toHaveURL(/\/restrictions\/edit\/[0-9a-f-]+$/);
	await expect(page.getByLabel("Restriction title / reason")).toHaveValue(
		title,
	);

	// The original keeps the other three
	await page.goBack();
	await expect(page.getByText("Restricted periods (3)")).toBeVisible();
});
