import { describe, expect, it } from "vitest";
import {
	competingApplications,
	findConflicts,
	moveItem,
	remainingApplications,
	roundPhase,
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
