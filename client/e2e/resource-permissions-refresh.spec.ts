import { type APIRequestContext, expect, type Page, test } from "@playwright/test";

const API_URL = `http://127.0.0.1:${process.env.E2E_API_PORT ?? "3100"}`;
const MEMBER_PASSWORD = "member-password";

// The member starts logged out; the admin acts through the API, like another browser would
test.use({ storageState: { cookies: [], origins: [] } });

/** A member's group, a public room, and a room the group has no access to yet */
async function setUp(request: APIRequestContext) {
	const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

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

	const group = await post("/groups", { name: `Group ${suffix}` });
	const collection = await post("/collections", {
		name: `Permissions ${suffix}`,
	});
	const publicRoom = await post("/resources", {
		collection_id: collection.id,
		name: `Open room ${suffix}`,
	});
	const room = await post("/resources", {
		collection_id: collection.id,
		name: `Restricted room ${suffix}`,
		is_public: false,
		reservation_restricted: true,
	});
	const email = `member-${suffix}@example.com`;
	await post("/users", {
		group_id: group.id,
		name: `Member ${suffix}`,
		email,
		password: MEMBER_PASSWORD,
		language: "en",
	});

	const setRoomGroups = async (groupIds: string[]) => {
		const res = await request.patch(`${API_URL}/resources/${room.id}`, {
			headers,
			data: { visibility_group_ids: groupIds, group_ids: groupIds },
		});
		expect(res.ok(), await res.text()).toBe(true);
	};

	return {
		email,
		publicRoomName: publicRoom.name as string,
		roomName: room.name as string,
		grantAccess: () => setRoomGroups([group.id]),
		revokeAccess: () => setRoomGroups([]),
	};
}

async function signIn(page: Page, email: string) {
	await page.getByRole("button", { name: "Log In", exact: true }).click();
	await page.getByRole("button", { name: "Sign in with password" }).click();
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(MEMBER_PASSWORD);
	await page.getByRole("button", { name: "Log In", exact: true }).click();
	await expect(page.getByRole("button", { name: "User account" })).toBeVisible();
}

// In-app navigation on purpose: page.goto would reload and empty the query cache
async function openFormInApp(page: Page) {
	await page.getByRole("link", { name: "New Booking" }).first().click();
	await expect(page).toHaveURL(/\/reservations\/create/);
}

const roomButton = (page: Page, name: string) =>
	page.getByRole("button", { name, exact: true });

test.describe("resource permission changes reach an open session", () => {
	test("a granted resource is offered after in-app navigation", async ({
		page,
		request,
	}) => {
		const { email, publicRoomName, roomName, grantAccess } =
			await setUp(request);

		await page.goto("/");
		await signIn(page, email);
		await openFormInApp(page);
		await expect(roomButton(page, publicRoomName)).toBeVisible();
		await expect(roomButton(page, roomName)).toBeHidden();

		await grantAccess();

		await page.goBack();
		await openFormInApp(page);
		await expect(roomButton(page, roomName)).toBeVisible();
	});

	test("a granted resource is offered when the tab regains focus", async ({
		page,
		request,
	}) => {
		const { email, publicRoomName, roomName, grantAccess } =
			await setUp(request);

		await page.goto("/");
		await signIn(page, email);
		await openFormInApp(page);
		await expect(roomButton(page, publicRoomName)).toBeVisible();
		await expect(roomButton(page, roomName)).toBeHidden();

		await grantAccess();

		await page.evaluate(() => window.dispatchEvent(new Event("visibilitychange")));
		await expect(roomButton(page, roomName)).toBeVisible();
	});

	test("a granted resource appears on a form left open", async ({
		page,
		request,
	}) => {
		const { email, publicRoomName, roomName, grantAccess } =
			await setUp(request);

		await page.clock.install();
		await page.goto("/");
		await signIn(page, email);
		await openFormInApp(page);
		await expect(roomButton(page, publicRoomName)).toBeVisible();
		await expect(roomButton(page, roomName)).toBeHidden();

		await grantAccess();

		await page.clock.fastForward(61_000);
		await expect(roomButton(page, roomName)).toBeVisible();
	});

	test("a selected resource is deselected when access is revoked", async ({
		page,
		request,
	}) => {
		const { email, roomName, grantAccess, revokeAccess } = await setUp(request);
		await grantAccess();

		await page.clock.install();
		await page.goto("/");
		await signIn(page, email);
		await openFormInApp(page);
		await roomButton(page, roomName).click();

		// The info dialog's trigger is only shown while something is selected
		const selectionInfo = page.getByRole("button", {
			name: "Resource details",
		});
		await expect(selectionInfo).toBeVisible();

		await revokeAccess();

		await page.clock.fastForward(61_000);
		await expect(roomButton(page, roomName)).toBeHidden();
		await expect(selectionInfo).toBeHidden();
	});

	test("logging in replaces resources cached as a guest", async ({
		page,
		request,
	}) => {
		const { email, publicRoomName, roomName, grantAccess } =
			await setUp(request);
		await grantAccess();

		const guestResources = page.waitForResponse(/\/resources$/);
		await page.goto("/");
		await guestResources;
		await signIn(page, email);

		// The header search stays mounted across login, so nothing remounts to refetch
		const search = page.getByRole("banner").getByRole("textbox");
		// Results are buttons; plain text would also match the "no results" message
		await search.fill(publicRoomName);
		await expect(roomButton(page, publicRoomName)).toBeVisible();
		await search.fill(roomName);
		await expect(roomButton(page, roomName)).toBeVisible();
	});
});
