import { describe, expect, it } from "vitest";
import {
	compactLocalizedRichText,
	getLocalizedPlainText,
	toLocalizedRichText,
} from "./richText";

const doc = (text: string) => ({
	type: "doc",
	content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

describe("toLocalizedRichText", () => {
	it("keeps localized documents", () => {
		expect(toLocalizedRichText({ fi: doc("Moi"), en: doc("Hi") })).toEqual({
			fi: doc("Moi"),
			en: doc("Hi"),
		});
	});

	it("turns a legacy plain string into a Finnish document", () => {
		const value = toLocalizedRichText("Eka rivi\n\n  Toka rivi \r\n");
		expect(Object.keys(value)).toEqual(["fi"]);
		expect(value.fi.content).toHaveLength(2);
		expect(getLocalizedPlainText("Eka rivi\nToka rivi", "sv")).toBe(
			"Eka rivi Toka rivi",
		);
	});

	it("returns an empty map for blank strings, null and non-documents", () => {
		expect(toLocalizedRichText("  \n ")).toEqual({});
		expect(toLocalizedRichText(null)).toEqual({});
		expect(toLocalizedRichText({ fi: "<p>html</p>" })).toEqual({});
	});
});

describe("compactLocalizedRichText", () => {
	it("drops empty languages and returns null when nothing is left", () => {
		expect(
			compactLocalizedRichText({
				fi: doc("Moi"),
				sv: { type: "doc", content: [] },
			}),
		).toEqual({ fi: doc("Moi") });
		expect(compactLocalizedRichText({ fi: doc("  ") })).toBeNull();
	});
});
