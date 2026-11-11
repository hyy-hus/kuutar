import { describe, expect, it } from "vitest";
import {
	type ConflictRestriction,
	findRestrictionConflicts,
	type ProposedOccurrence,
} from "./restrictionConflicts";

const at = (time: string) => `2026-11-11T${time}:00.000Z`;

const proposed = (
	resource: string,
	start: string,
	end: string,
): ProposedOccurrence => ({
	resource_id: resource,
	start_time: at(start),
	end_time: at(end),
});

const restriction = (
	overrides: Partial<ConflictRestriction> = {},
): ConflictRestriction => ({
	title: "Board meeting",
	exempt_group_ids: [],
	occurrences: [
		{ resource_id: "r1", start_time: at("15:00"), end_time: at("17:00") },
	],
	...overrides,
});

describe("findRestrictionConflicts", () => {
	it("reports an overlap on the restricted resource", () => {
		expect(
			findRestrictionConflicts(
				[proposed("r1", "16:00", "18:00")],
				[restriction()],
				"g1",
			),
		).toEqual([
			{
				title: "Board meeting",
				start_time: at("16:00"),
				end_time: at("18:00"),
			},
		]);
	});

	it("skips restrictions that exempt the user's group", () => {
		expect(
			findRestrictionConflicts(
				[proposed("r1", "16:00", "18:00")],
				[restriction({ exempt_group_ids: ["g1"] })],
				"g1",
			),
		).toEqual([]);
	});

	it("still applies when another group is exempt", () => {
		expect(
			findRestrictionConflicts(
				[proposed("r1", "16:00", "18:00")],
				[restriction({ exempt_group_ids: ["g2"] })],
				"g1",
			),
		).toHaveLength(1);
	});

	it("applies restrictions without a resource to every resource", () => {
		const global = restriction({
			occurrences: [
				{ resource_id: null, start_time: at("15:00"), end_time: at("17:00") },
			],
		});
		expect(
			findRestrictionConflicts(
				[proposed("r9", "15:30", "16:00")],
				[global],
				"g1",
			),
		).toHaveLength(1);
	});

	it("ignores other resources and touching ends", () => {
		expect(
			findRestrictionConflicts(
				[proposed("r2", "16:00", "18:00"), proposed("r1", "17:00", "18:00")],
				[restriction()],
				"g1",
			),
		).toEqual([]);
	});

	it("lists a title/time pair once across resources", () => {
		const global = restriction({
			occurrences: [
				{ resource_id: null, start_time: at("15:00"), end_time: at("17:00") },
			],
		});
		expect(
			findRestrictionConflicts(
				[proposed("r1", "16:00", "18:00"), proposed("r2", "16:00", "18:00")],
				[global],
				"g1",
			),
		).toHaveLength(1);
	});
});
