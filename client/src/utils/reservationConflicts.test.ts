import { describe, expect, it } from "vitest";
import {
	type ConflictReservation,
	findConflicts,
	reservationsOverlap,
} from "./reservationConflicts";

const res = (
	id: string,
	resource: string,
	start: string,
	end: string,
	status = "pending",
): ConflictReservation => ({
	id,
	status,
	occurrences: [
		{
			resource_id: resource,
			start_time: `2026-11-12T${start}:00Z`,
			end_time: `2026-11-12T${end}:00Z`,
		},
	],
});

describe("reservationsOverlap", () => {
	it("detects overlap on the same resource", () => {
		expect(
			reservationsOverlap(
				res("a", "r1", "08:00", "10:00"),
				res("b", "r1", "09:00", "11:00"),
			),
		).toBe(true);
	});
	it("ignores other resources and touching ends", () => {
		const a = res("a", "r1", "08:00", "10:00");
		expect(reservationsOverlap(a, res("b", "r2", "09:00", "11:00"))).toBe(
			false,
		);
		expect(reservationsOverlap(a, res("c", "r1", "10:00", "11:00"))).toBe(
			false,
		);
	});
	it("never conflicts with itself", () => {
		const a = res("a", "r1", "08:00", "10:00");
		expect(reservationsOverlap(a, a)).toBe(false);
	});
});

describe("findConflicts", () => {
	it("maps pending reservations to overlapping live ones and skips cancelled", () => {
		const a = res("a", "r1", "08:00", "10:00");
		const b = res("b", "r1", "09:00", "11:00");
		const c = res("c", "r1", "09:00", "11:00", "cancelled");
		const d = res("d", "r1", "09:30", "10:30", "confirmed");
		const map = findConflicts([a, b], [a, b, c, d]);
		expect(map.get("a")?.map((r) => r.id)).toEqual(["b", "d"]);
		expect(map.get("b")?.map((r) => r.id)).toEqual(["a", "d"]);
	});
	it("omits reservations without conflicts", () => {
		const a = res("a", "r1", "08:00", "09:00");
		expect(findConflicts([a], [a]).size).toBe(0);
	});
});
