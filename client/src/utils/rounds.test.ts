import { describe, expect, it } from "vitest";
import {
	competingApplications,
	findConflicts,
	moveItem,
	openRoundPeriodEnd,
	remainingApplications,
	roundForSlot,
	roundPhase,
	roundPreselection,
	selectApplication,
} from "./rounds";

const round = {
	status: "active" as const,
	applications_open_at: "2026-11-10T10:00:00Z",
	applications_close_at: "2026-11-12T10:00:00Z",
};

describe("roundPhase", () => {
	it("derives the phase from the times", () => {
		expect(roundPhase(round, new Date("2026-11-09T10:00:00Z"))).toBe(
			"upcoming",
		);
		expect(roundPhase(round, new Date("2026-11-11T10:00:00Z"))).toBe("open");
		expect(roundPhase(round, new Date("2026-11-13T10:00:00Z"))).toBe(
			"allocating",
		);
	});

	it("is completed once completed regardless of time", () => {
		expect(
			roundPhase(
				{ ...round, status: "completed" },
				new Date("2026-11-11T10:00:00Z"),
			),
		).toBe("completed");
	});
});

describe("remainingApplications", () => {
	it("never goes negative", () => {
		expect(remainingApplications(3, 1)).toBe(2);
		expect(remainingApplications(3, 5)).toBe(0);
	});
});

describe("moveItem", () => {
	it("swaps neighbours and ignores out-of-range moves", () => {
		expect(moveItem(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
		expect(moveItem(["a", "b", "c"], 0, -1)).toEqual(["a", "b", "c"]);
		expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "b", "c"]);
	});
});

describe("allocation helpers", () => {
	const apps = [
		{
			reservation_id: "r1",
			user_id: "u1",
			resource_id: "x",
			start_time: "2026-12-01T10:00:00Z",
		},
		{
			reservation_id: "r2",
			user_id: "u2",
			resource_id: "x",
			start_time: "2026-12-01T10:00:00Z",
		},
		{
			reservation_id: "r3",
			user_id: "u1",
			resource_id: "x",
			start_time: "2026-12-02T10:00:00Z",
		},
		{
			reservation_id: "r4",
			user_id: "u1",
			resource_id: "y",
			start_time: "2026-12-01T10:00:00Z",
			externally_taken: true,
		},
	];

	it("selects one application per user and resource", () => {
		expect(selectApplication(["r1", "r2"], apps, "u1", "x", "r3")).toEqual([
			"r2",
			"r3",
		]);
		expect(selectApplication(["r1", "r2"], apps, "u1", "x", null)).toEqual([
			"r2",
		]);
	});

	it("finds shared and externally taken blocks", () => {
		const conflicts = findConflicts(["r1", "r2", "r4"], apps);
		expect(conflicts.get("r1")).toEqual({
			sharedWith: ["r2"],
			externallyTaken: false,
		});
		expect(conflicts.get("r2")?.sharedWith).toEqual(["r1"]);
		expect(conflicts.get("r4")).toEqual({
			sharedWith: [],
			externallyTaken: true,
		});
		expect(findConflicts(["r1", "r3"], apps).size).toBe(0);
	});

	it("lists competing applications for a block", () => {
		expect(
			competingApplications(apps[0], apps).map((a) => a.reservation_id),
		).toEqual(["r2"]);
		expect(competingApplications(apps[2], apps)).toEqual([]);
	});
});

const slotRound = {
	...round,
	id: "r1",
	resource_ids: ["hall"],
	period_start: "2027-01-11T00:00:00Z",
	period_end: "2027-06-21T00:00:00Z",
};
const during = new Date("2026-11-11T10:00:00Z");

describe("roundForSlot", () => {
	const slot = {
		resource_id: "hall",
		start_time: "2027-04-01T15:00:00Z",
		end_time: "2027-04-01T18:00:00Z",
	};

	it("finds the open round covering the resource and slot", () => {
		expect(roundForSlot([slotRound], slot, during)?.id).toBe("r1");
	});

	it("ignores other resources, slots outside the period and closed windows", () => {
		expect(
			roundForSlot([slotRound], { ...slot, resource_id: "other" }, during),
		).toBeUndefined();
		expect(
			roundForSlot(
				[slotRound],
				{ ...slot, end_time: "2027-06-22T10:00:00Z" },
				during,
			),
		).toBeUndefined();
		expect(
			roundForSlot([slotRound], slot, new Date("2026-11-09T10:00:00Z")),
		).toBeUndefined();
	});

	it("returns nothing for an unset time", () => {
		expect(
			roundForSlot([slotRound], { ...slot, start_time: "" }, during),
		).toBeUndefined();
	});
});

describe("openRoundPeriodEnd", () => {
	it("is the latest period end of the open rounds covering the resource", () => {
		const later = {
			...slotRound,
			period_end: "2027-08-01T00:00:00Z",
		};
		expect(openRoundPeriodEnd([slotRound, later], "hall", during)).toEqual(
			new Date("2027-08-01T00:00:00Z"),
		);
	});

	it("is undefined without an open round for the resource", () => {
		expect(openRoundPeriodEnd([slotRound], "other", during)).toBeUndefined();
		expect(
			openRoundPeriodEnd([slotRound], "hall", new Date("2026-11-13T10:00:00Z")),
		).toBeUndefined();
	});
});

describe("roundPreselection", () => {
	it("preselects a round's only resource", () => {
		expect(roundPreselection({ resource_ids: ["hall"] })).toEqual(["hall"]);
	});

	it("leaves several resources for the user to pick", () => {
		expect(roundPreselection({ resource_ids: ["a", "b"] })).toBeUndefined();
	});
});
