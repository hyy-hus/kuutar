import {
	type APIRequestContext,
	type Browser,
	expect,
	type Page,
	test,
} from "@playwright/test";

const API_URL = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3100"}`;
const MEMBER_PASSWORD = "member-password";

const uniqueSuffix = () => `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

/** A logged-out browser context with the project's base URL and locale */
async function guestPage(browser: Browser) {
	const { baseURL, locale } = test.info().project.use;
	const context = await browser.newContext({
		baseURL,
		locale,
		storageState: { cookies: [], origins: [] },
	});
	return context.newPage();
}

const sidebarNews = (page: Page, unread?: number) =>
	page.getByRole("link", {
		name: unread ? `News, ${unread} unread` : "News",
		exact: true,
	});

test("admin publishes a highlighted news item that guests see on the home page", async ({
	page,
	browser,
}) => {
	const title = `Opening hours ${uniqueSuffix()}`;
	const blurb = "The building is closed on Friday.";

	await page.goto("/news");
	await page.getByRole("link", { name: "New news item" }).first().click();
	await expect(page).toHaveURL(/\/news\/create$/);

	// Creating without a title shows the validation error and keeps the form
	await page.getByLabel("Title (EN)").fill("x");
	await page.getByLabel("Title (EN)").fill("");
	await expect(
		page.getByText("Enter a title in at least one language."),
	).toBeVisible();

	await page.getByLabel("Title (EN)").fill(title);
	await page.getByLabel("Summary (EN)").fill(blurb);
	await page.getByRole("button", { name: "Everyone", exact: true }).click();
	await page.getByRole("button", { name: "Publish", exact: true }).click();
	await page.getByLabel("Highlight on the home page").check();
	await page.getByRole("button", { name: "Create news item" }).click();

	await expect(page).toHaveURL(/\/news\/[0-9a-f-]+$/);
	await expect(page.getByRole("heading", { name: title })).toBeVisible();
	await expect(page.getByText(blurb)).toBeVisible();

	// A guest sees the highlight without a dismiss button and can open it
	const guest = await guestPage(browser);
	await guest.goto("/");
	const highlights = guest.getByRole("region", { name: "Highlighted news" });
	await expect(highlights.getByRole("heading", { name: title })).toBeVisible();
	await expect(highlights.getByText(blurb)).toBeVisible();
	await expect(
		highlights.getByRole("button", { name: `Hide: ${title}` }),
	).toHaveCount(0);
	await highlights.getByRole("link", { name: `Read more: ${title}` }).click();
	await expect(guest.getByRole("heading", { name: title })).toBeVisible();
	await expect(guest.getByRole("button", { name: "Edit" })).toHaveCount(0);

	// Deleting removes it for guests too
	page.once("dialog", (dialog) => dialog.accept());
	await page.getByRole("button", { name: "Delete news item" }).click();
	await expect(page).toHaveURL(/\/news$/);
	await guest.goto("/news");
	await expect(guest.getByRole("heading", { name: "News" })).toBeVisible();
	await expect(guest.getByText(title)).toHaveCount(0);
	await guest.context().close();
});

/**
 * A member and four items: a highlight, two plain items and one for another group.
 * All are published at the member's account creation, since older items count as read.
 */
async function setUpMemberNews(request: APIRequestContext) {
	const suffix = uniqueSuffix();

	const login = await request.post(`${API_URL}/auth/login`, {
		data: { email: "admin@localhost", password: "Admin" },
	});
	expect(login.ok()).toBe(true);
	const { access_token } = await login.json();
	const headers = { Authorization: `Bearer ${access_token}` };

	const post = async (path: string, data: object) => {
		const res = await request.post(`${API_URL}${path}`, { headers, data });
		expect(res.ok(), `POST ${path}: ${await res.text()}`).toBe(true);
		return res.json();
	};

	const group = await post("/groups", { name: `Readers ${suffix}` });
	const otherGroup = await post("/groups", { name: `Others ${suffix}` });
	const email = `reader-${suffix}@example.com`;
	const member = await post("/users", {
		group_id: group.id,
		name: `Reader ${suffix}`,
		email,
		password: MEMBER_PASSWORD,
		language: "en",
	});

	const createNews = async (title: string, extra: object = {}) => {
		await post("/news", {
			title: { en: title },
			blurb: { en: `About ${title}` },
			visibility: "users",
			published_at: member.created_at,
			...extra,
		});
		return title;
	};

	return {
		email,
		highlight: await createNews(`Highlight ${suffix}`, { highlighted: true }),
		first: await createNews(`First ${suffix}`),
		second: await createNews(`Second ${suffix}`),
		hidden: await createNews(`Other group ${suffix}`, {
			visibility: "groups",
			visible_group_ids: [otherGroup.id],
		}),
	};
}

test.describe("a member's unread news", () => {
	test.use({ storageState: { cookies: [], origins: [] } });

	test("the sidebar badge follows dismissing, opening and marking all read", async ({
		page,
		request,
	}) => {
		const { email, highlight, first, second, hidden } =
			await setUpMemberNews(request);

		await page.goto("/");
		await page.getByRole("button", { name: "Log In", exact: true }).click();
		await page.getByRole("button", { name: "Sign in with password" }).click();
		await page.getByLabel("Email").fill(email);
		await page.getByLabel("Password").fill(MEMBER_PASSWORD);
		await page.getByRole("button", { name: "Log In", exact: true }).click();
		await expect(
			page.getByRole("button", { name: "User account" }),
		).toBeVisible();

		// The other group's item is neither listed nor counted
		await expect(sidebarNews(page, 3)).toBeVisible();

		// Dismissing the highlight marks it read
		const highlights = page.getByRole("region", { name: "Highlighted news" });
		await expect(
			highlights.getByRole("heading", { name: highlight }),
		).toBeVisible();
		await highlights.getByRole("button", { name: `Hide: ${highlight}` }).click();
		// Other tests' highlights may still show; only this one has to go
		await expect(
			highlights.getByRole("heading", { name: highlight }),
		).toHaveCount(0);
		await expect(sidebarNews(page, 2)).toBeVisible();

		await sidebarNews(page, 2).click();
		await expect(page).toHaveURL(/\/news$/);
		const unreadLink = (title: string) =>
			page.getByRole("link", { name: new RegExp(`Unread: ${title}`) });
		await expect(unreadLink(first)).toBeVisible();
		await expect(unreadLink(second)).toBeVisible();
		await expect(unreadLink(highlight)).toHaveCount(0);
		await expect(
			page.getByRole("heading", { name: highlight, exact: true }),
		).toBeVisible();
		await expect(page.getByText(hidden)).toHaveCount(0);

		// Opening an item marks it read
		await unreadLink(first).click();
		await expect(page.getByRole("heading", { name: first })).toBeVisible();
		await expect(sidebarNews(page, 1)).toBeVisible();

		await page.getByRole("link", { name: "Back to news" }).click();
		await expect(unreadLink(first)).toHaveCount(0);
		await expect(unreadLink(second)).toBeVisible();

		await page.getByRole("button", { name: "Mark all as read" }).click();
		await expect(unreadLink(second)).toHaveCount(0);
		await expect(sidebarNews(page)).toBeVisible();
		await expect(
			page.getByRole("button", { name: "Mark all as read" }),
		).toHaveCount(0);
	});
});
