import { expect, test } from "@playwright/test";
import { ANCHOR_DATE, API_URL } from "../../playwright.screenshots.config";
import { freshDir } from "./output";

type Theme = "light" | "dark";
type Locale = "fi" | "en";

/** Ids of seeded records, looked up through the API, for the pages that show one record */
interface Ids {
	reservation: string;
	pendingReservation: string;
	resource: string;
	collection: string;
	group: string;
	user: string;
	round: string;
	block: string;
	restriction: string;
	news: string;
}

interface Shot {
	name: string;
	path: string | ((ids: Ids) => string);
	/** Something that is on screen once the page has its data */
	ready?: string;
	mobile?: boolean;
	/** Capture without signing in */
	guest?: boolean;
	/** Also captured in these other locale/theme combinations (fi/light is always captured) */
	variants?: [Locale, Theme][];
}

const EXTRA: [Locale, Theme][] = [
	["en", "light"],
	["fi", "dark"],
];

const RESERVATION_LINK = "a[href^='/reservations/']";

// Every route of the app. Keep this in step with src/routes.
const SHOTS: Shot[] = [
	// Public
	{ name: "home-guest", path: "/", guest: true },
	{ name: "home", path: "/", variants: EXTRA },
	{
		name: "calendar-month",
		path: "/calendar?view=month&start=2026-11-01",
		ready: RESERVATION_LINK,
		variants: EXTRA,
	},
	{
		name: "calendar-week",
		path: "/calendar?view=days&days=7&start=2026-11-09",
		ready: RESERVATION_LINK,
	},
	{
		name: "calendar-month-mobile",
		path: "/calendar?view=month&start=2026-11-01",
		ready: RESERVATION_LINK,
		mobile: true,
	},
	{ name: "me", path: "/me" },

	// News
	{ name: "news-guest", path: "/news", guest: true },
	{ name: "news", path: "/news", variants: EXTRA },
	{ name: "news-new", path: "/news/create" },
	{ name: "news-detail", path: (i) => `/news/${i.news}` },
	{ name: "news-edit", path: (i) => `/news/edit/${i.news}` },
	{ name: "stats", path: "/stats" },
	{ name: "sandbox", path: "/sandbox" },

	// Reservations
	{ name: "reservations", path: "/reservations" },
	{ name: "reservation-new", path: "/reservations/create" },
	{ name: "reservation-detail", path: (i) => `/reservations/${i.reservation}` },
	{
		name: "reservation-detail-pending",
		path: (i) => `/reservations/${i.pendingReservation}`,
	},
	{
		name: "reservation-edit",
		path: (i) => `/reservations/edit/${i.reservation}`,
	},
	{ name: "reservation-round", path: (i) => `/reservations/rounds/${i.round}` },

	// Resources, collections, contracts
	{ name: "resources", path: "/resources" },
	{ name: "resource-new", path: "/resources/create" },
	{ name: "resource-detail", path: (i) => `/resources/${i.resource}` },
	{ name: "resource-edit", path: (i) => `/resources/edit/${i.resource}` },
	{ name: "collections", path: "/collections" },
	{ name: "collection-new", path: "/collections/create" },
	{ name: "collection-detail", path: (i) => `/collections/${i.collection}` },
	{ name: "collection-edit", path: (i) => `/collections/edit/${i.collection}` },
	{ name: "contracts", path: "/contracts" },

	// Restrictions and reservable blocks
	{ name: "restrictions", path: "/restrictions" },
	{ name: "restriction-new", path: "/restrictions/create" },
	{ name: "restriction-detail", path: (i) => `/restrictions/${i.restriction}` },
	{
		name: "restriction-edit",
		path: (i) => `/restrictions/edit/${i.restriction}`,
	},
	{ name: "reservable-blocks", path: "/reservable-blocks" },
	{ name: "reservable-block-new", path: "/reservable-blocks/create" },
	{ name: "reservable-block-detail", path: (i) => `/reservable-blocks/${i.block}` },
	{
		name: "reservable-block-edit",
		path: (i) => `/reservable-blocks/edit/${i.block}`,
	},

	// Admin
	{ name: "approval-dashboard", path: "/admin/dashboard", variants: EXTRA },
	{ name: "admin-reservations", path: "/admin/reservations" },
	{ name: "admin-email-templates", path: "/admin/email-templates" },
	{ name: "admin-outlook", path: "/admin/outlook" },
	{ name: "admin-groups", path: "/admin/groups" },
	{ name: "admin-group-new", path: "/admin/groups/create" },
	{ name: "admin-group-detail", path: (i) => `/admin/groups/${i.group}` },
	{ name: "admin-group-edit", path: (i) => `/admin/groups/edit/${i.group}` },
	{ name: "admin-users", path: "/admin/users" },
	{ name: "admin-user-new", path: "/admin/users/create" },
	{ name: "admin-users-batch-register", path: "/admin/users/batch-register" },
	{ name: "admin-user-detail", path: (i) => `/admin/users/${i.user}` },
	{ name: "admin-user-edit", path: (i) => `/admin/users/edit/${i.user}` },
	{ name: "admin-rounds", path: "/admin/rounds" },
	{ name: "admin-round-new", path: "/admin/rounds/create" },
	{ name: "admin-round-detail", path: (i) => `/admin/rounds/${i.round}` },
	{ name: "admin-round-edit", path: (i) => `/admin/rounds/edit/${i.round}` },
];

const ADMIN = { email: "admin@example.test", password: "dev-password" };

const PINNED_NOW = new Date(`${ANCHOR_DATE}T12:00:00+02:00`);

interface Named {
	id: string;
	name?: string;
	title?: string;
}

let outDir: string;
let ids: Ids;

test.beforeAll(async ({ playwright }) => {
	outDir = freshDir("pages");
	const request = await playwright.request.newContext();

	const login = await request.post(`${API_URL}/auth/login`, {
		data: ADMIN,
	});
	const { access_token } = await login.json();
	const get = async <T>(path: string): Promise<T> => {
		const res = await request.get(`${API_URL}${path}`, {
			headers: { Authorization: `Bearer ${access_token}` },
		});
		expect(res.ok(), path).toBeTruthy();
		return res.json();
	};
	const first = <T extends Named>(
		list: T[],
		match: (item: T) => boolean,
		what: string,
	): string => {
		const found = list.find(match);
		if (!found) throw new Error(`No seeded ${what}; was the mock data seeded?`);
		return found.id;
	};

	const range = "start_date=2026-01-01T00:00:00Z&end_date=2026-12-31T23:59:59Z";
	const reservations = await get<(Named & { status: string; rrule?: string })[]>(
		`/reservations?${range}`,
	);
	ids = {
		reservation: first(
			reservations,
			(r) => r.status === "confirmed" && !!r.rrule,
			"recurring reservation",
		),
		pendingReservation: first(
			reservations,
			(r) => r.status === "pending",
			"pending reservation",
		),
		resource: first(
			await get<Named[]>("/resources"),
			(r) => r.name === "Kristallisali",
			"resource",
		),
		collection: first(
			await get<Named[]>("/collections"),
			(c) => c.name === "Juhlatilat",
			"collection",
		),
		group: first(
			await get<Named[]>("/groups"),
			(g) => g.name === "Kuutamo ry",
			"group",
		),
		user: first(
			await get<(Named & { email: string })[]>("/users"),
			(u) => u.email === "user@example.test",
			"user",
		),
		round: first(
			await get<Named[]>("/rounds"),
			(r) => r.name === "Kevätlukukauden varausvuoro",
			"round",
		),
		block: first(
			await get<Named[]>(`/reservable-blocks?${range}`),
			() => true,
			"reservable block",
		),
		restriction: first(
			await get<Named[]>(`/restrictions?${range}`),
			(r) => r.title === "Joulusulku",
			"restriction",
		),
		news: first(
			(await get<{ id: string; title: Record<string, string> }[]>("/news")).map(
				(n) => ({ id: n.id, name: n.title.fi }),
			),
			(n) => n.name === "Joulun aukioloajat",
			"news item",
		),
	};
	await request.dispose();
});

for (const shot of SHOTS) {
	const combos: [Locale, Theme][] = [["fi", "light"], ...(shot.variants ?? [])];
	for (const [locale, theme] of combos) {
		test(`${shot.name} (${locale}, ${theme})`, async ({ page, request }) => {
			// A fresh login per test: refresh tokens rotate, so a login shared between tests
			// would be revoked as soon as one of them refreshed it
			const login = shot.guest
				? undefined
				: await request.post(`${API_URL}/auth/login`, { data: ADMIN });
			if (login) expect(login.ok()).toBeTruthy();
			const tokens = login ? await login.json() : undefined;
			const expiresAt = Date.now() + (tokens?.expires_in ?? 0) * 1000;
			const path = typeof shot.path === "function" ? shot.path(ids) : shot.path;

			// Same "today" as the seeded data, so the calendar and its relative dates are stable
			await page.clock.setFixedTime(PINNED_NOW);
			await page.addInitScript(
				([l, t, access, refresh, exp]) => {
					localStorage.setItem("kuutar.language", l);
					localStorage.setItem("theme", t);
					if (access) {
						localStorage.setItem("access_token", access);
						localStorage.setItem("refresh_token", refresh);
						localStorage.setItem("token_expires_at", exp);
					}
				},
				[
					locale,
					theme,
					tokens?.access_token ?? "",
					tokens?.refresh_token ?? "",
					String(expiresAt),
				],
			);
			if (shot.mobile) await page.setViewportSize({ width: 390, height: 844 });

			await page.goto(path);
			await page.waitForLoadState("networkidle");
			// A protected page that bounced to the front page would make a wrong screenshot
			const wanted = new URL(path, "http://x").pathname;
			expect(new URL(page.url()).pathname).toBe(wanted);
			if (shot.ready) {
				await expect(page.locator(shot.ready).first()).toBeVisible();
			}
			// Let layout effects and fonts settle
			await page.evaluate(() => document.fonts.ready);
			await page.waitForTimeout(500);

			const suffix =
				locale === "fi" && theme === "light" ? "" : `.${locale}.${theme}`;
			await page.screenshot({
				path: `${outDir}/${shot.name}${suffix}.png`,
				animations: "disabled",
			});
		});
	}
}
