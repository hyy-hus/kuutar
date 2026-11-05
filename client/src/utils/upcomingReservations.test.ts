import { describe, expect, it } from "vitest";
import { upcomingReservations } from "./upcomingReservations";

const NOW = new Date("2026-11-05T12:00:00Z");

const occurrence = (start_time: string, end_time: string) => ({
	start_time,
	end_time,
});

const reservation = (
	id: string,
	occurrences: { start_time: string; end_time: string }[] | null,
	status = "confirmed",
) => ({ id, status, occurrences });

const ids = (reservations: ReturnType<typeof reservation>[]) =>
	upcomingReservations(reservations, NOW).map((u) => u.reservation.id);

const PAST = occurrence("2026-03-01T10:00:00Z", "2026-03-01T11:00:00Z");
const SOON = occurrence("2026-11-06T10:00:00Z", "2026-11-06T11:00:00Z");
const LATER = occurrence("2027-01-10T10:00:00Z", "2027-01-10T11:00:00Z");

describe("upcomingReservations", () => {
	it("drops a reservation that has fully passed", () => {
		expect(ids([reservation("past", [PAST])])).toEqual([]);
	});

	it("drops a cancelled reservation", () => {
		expect(ids([reservation("cancelled", [SOON], "cancelled")])).toEqual([]);
	});

	it("drops a reservation without occurrences", () => {
		expect(ids([reservation("empty", []), reservation("none", null)])).toEqual(
			[],
		);
	});

	it("keeps a pending reservation", () => {
		expect(ids([reservation("pending", [SOON], "pending")])).toEqual([
			"pending",
		]);
	});

	it("keeps a booking in progress", () => {
		const inProgress = occurrence(
			"2026-11-05T11:00:00Z",
			"2026-11-05T13:00:00Z",
		);
		expect(ids([reservation("ongoing", [inProgress])])).toEqual(["ongoing"]);
	});

	it("drops an occurrence ending exactly now", () => {
		const justEnded = occurrence(
			"2026-11-05T11:00:00Z",
			"2026-11-05T12:00:00Z",
		);
		expect(ids([reservation("ended", [justEnded])])).toEqual([]);
	});

	it("reports the next occurrence of a series, not its first", () => {
		const [upcoming] = upcomingReservations(
			[reservation("series", [PAST, LATER, SOON])],
			NOW,
		);
		expect(upcoming.nextOccurrence).toEqual(SOON);
	});

	it("sorts by next start regardless of input order", () => {
		expect(
			ids([
				reservation("later", [LATER]),
				reservation("past", [PAST]),
				reservation("soon", [SOON]),
			]),
		).toEqual(["soon", "later"]);
	});
});
