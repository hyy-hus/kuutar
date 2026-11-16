import { faker } from "@faker-js/faker/locale/fi";
import type { components } from "#/api/schema";

/**
 * Deterministic, fictional API objects for stories and tests. Nothing here is derived from
 * production data. Call `resetFixtures()` to restart the sequence.
 */
type Resource = components["schemas"]["Resource"];
type Reservation = components["schemas"]["Reservation"];
type News = components["schemas"]["News"];
type Round = components["schemas"]["Round"];

const NOW = "2026-11-11T09:00:00.000Z";

export function resetFixtures(seed = 7) {
	faker.seed(seed);
}
resetFixtures();

export function makeResource(overrides: Partial<Resource> = {}): Resource {
	return {
		id: faker.string.uuid(),
		collection_id: faker.string.uuid(),
		name: `${faker.word.adjective()} ${faker.word.noun()}`,
		allow_recurring: true,
		auto_confirm: false,
		auto_confirm_group_ids: [],
		blocks_only: false,
		can_reserve: true,
		is_public: true,
		reservation_restricted: false,
		reservable_group_ids: [],
		visible_group_ids: [],
		created_at: NOW,
		updated_at: NOW,
		...overrides,
	};
}

export function makeReservation(
	overrides: Partial<Reservation> = {},
): Reservation {
	return {
		id: faker.string.uuid(),
		user_id: faker.string.uuid(),
		user_name: faker.person.fullName(),
		user_email: `${faker.string.alphanumeric(8).toLowerCase()}@example.test`,
		title: faker.helpers.arrayElement([
			"Hallituksen kokous",
			"Sitsit",
			"Elokuvailta",
			"Workshop",
		]),
		status: "confirmed",
		source: "kuutar",
		created_at: NOW,
		updated_at: NOW,
		...overrides,
	};
}

/** A published news item; `NewsSummary` fields are a subset, so it works for lists too */
export function makeNews(overrides: Partial<News> = {}): News {
	const title = faker.helpers.arrayElement([
		"Joulun aukioloajat",
		"Kevään varauskierros avautuu",
		"Grillin käyttöohjeet",
	]);
	return {
		id: faker.string.uuid(),
		title: { fi: title, en: `${title} (en)` },
		blurb: { fi: `${title}: lyhyt kuvaus.` },
		body: null,
		visibility: "public",
		visible_group_ids: [],
		published_at: "2026-11-10T09:00:00.000Z",
		highlighted: false,
		highlight_until: null,
		is_read: false,
		created_at: NOW,
		updated_at: NOW,
		...overrides,
	};
}

/** A reservation round whose application window is open at the fixtures' NOW */
export function makeRound(overrides: Partial<Round> = {}): Round {
	return {
		id: faker.string.uuid(),
		name: faker.helpers.arrayElement([
			"Kevään varauskierros",
			"Salin ennakkovarauskierros",
		]),
		description: null,
		applications_open_at: "2026-11-09T22:00:00.000Z",
		applications_close_at: "2026-11-15T21:59:00.000Z",
		period_start: "2027-01-10T22:00:00.000Z",
		period_end: "2027-06-21T20:59:00.000Z",
		max_pending_per_resource: 3,
		resource_ids: [faker.string.uuid()],
		group_ids: [faker.string.uuid()],
		status: "active",
		phase: "open",
		completed_at: null,
		created_at: NOW,
		...overrides,
	};
}
