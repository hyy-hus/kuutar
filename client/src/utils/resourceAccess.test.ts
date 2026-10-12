import { describe, expect, it } from "vitest";
import {
	type ResourceAccessInput,
	summarizeResourceAccess,
} from "./resourceAccess";

const base: ResourceAccessInput = {
	is_public: true,
	visibility_group_ids: [],
	reservation_restricted: false,
	reserve_group_ids: [],
	auto_confirm: false,
	auto_confirm_group_ids: [],
};

describe("summarizeResourceAccess", () => {
	it("lets everyone see and reserve a public, unrestricted resource", () => {
		expect(summarizeResourceAccess(base)).toEqual({
			see: { kind: "everyone" },
			reserve: { kind: "everyone" },
			confirm: { kind: "approval" },
		});
	});

	it("limits a non-public resource to its visibility groups", () => {
		const summary = summarizeResourceAccess({
			...base,
			is_public: false,
			visibility_group_ids: ["a"],
		});
		expect(summary.see).toEqual({ kind: "groups", groupIds: ["a"] });
		// Unrestricted: whoever sees it may reserve it
		expect(summary.reserve).toEqual({ kind: "groups", groupIds: ["a"] });
	});

	it("makes a non-public resource with no groups admin-only", () => {
		const summary = summarizeResourceAccess({ ...base, is_public: false });
		expect(summary.see).toEqual({ kind: "admins" });
		expect(summary.reserve).toEqual({ kind: "admins" });
	});

	it("lets reserving groups see a non-public resource without duplicates", () => {
		const summary = summarizeResourceAccess({
			...base,
			is_public: false,
			visibility_group_ids: ["a", "b"],
			reservation_restricted: true,
			reserve_group_ids: ["b", "c"],
		});
		expect(summary.see).toEqual({ kind: "groups", groupIds: ["a", "b", "c"] });
		expect(summary.reserve).toEqual({ kind: "groups", groupIds: ["b", "c"] });
	});

	it("keeps a public resource visible to all when reserving is restricted", () => {
		const summary = summarizeResourceAccess({
			...base,
			reservation_restricted: true,
			reserve_group_ids: ["a"],
		});
		expect(summary.see).toEqual({ kind: "everyone" });
		expect(summary.reserve).toEqual({ kind: "groups", groupIds: ["a"] });
	});

	it("treats restricted with no groups as admins-only reserving", () => {
		const summary = summarizeResourceAccess({
			...base,
			reservation_restricted: true,
		});
		expect(summary.reserve).toEqual({ kind: "admins" });
	});

	it("maps auto-confirm to everyone or to selected groups", () => {
		expect(
			summarizeResourceAccess({ ...base, auto_confirm: true }).confirm,
		).toEqual({ kind: "everyone" });
		expect(
			summarizeResourceAccess({
				...base,
				auto_confirm: true,
				auto_confirm_group_ids: ["a"],
			}).confirm,
		).toEqual({ kind: "groups", groupIds: ["a"] });
	});

	it("ignores auto-confirm groups while auto-confirm is off", () => {
		expect(
			summarizeResourceAccess({ ...base, auto_confirm_group_ids: ["a"] })
				.confirm,
		).toEqual({ kind: "approval" });
	});
});
