import { describe, expect, it } from "vitest";
import { parseResourceList, touchesResources } from "./resourceSearch";

describe("parseResourceList", () => {
	it("accepts arrays, comma strings and the legacy single id", () => {
		expect(parseResourceList(["a", "b"])).toEqual(["a", "b"]);
		expect(parseResourceList("a,b,")).toEqual(["a", "b"]);
		expect(parseResourceList(undefined, "x")).toEqual(["x"]);
		expect(parseResourceList(undefined, "")).toBeUndefined();
		expect(parseResourceList(undefined)).toBeUndefined();
	});

	it("keeps an explicit empty selection", () => {
		expect(parseResourceList([])).toEqual([]);
		expect(parseResourceList("")).toEqual([]);
	});
});

describe("touchesResources", () => {
	const occ = [{ resource_id: "a" }, { resource_id: "b" }];
	it("matches any selected resource, everything when nothing is selected", () => {
		expect(touchesResources(occ, undefined)).toBe(true);
		expect(touchesResources(occ, ["b"])).toBe(true);
		expect(touchesResources(occ, ["c"])).toBe(false);
		expect(touchesResources(occ, [])).toBe(false);
		expect(touchesResources(undefined, ["a"])).toBe(false);
	});
});
