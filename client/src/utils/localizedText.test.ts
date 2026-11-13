import { describe, expect, it } from "vitest";
import {
	compactLocalizedText,
	getLocalizedString,
	toLocalizedText,
} from "./localizedText";

describe("toLocalizedText", () => {
	it("keeps only string values", () => {
		expect(toLocalizedText({ fi: "Moi", en: 3, sv: null })).toEqual({
			fi: "Moi",
		});
		expect(toLocalizedText(null)).toEqual({});
		expect(toLocalizedText("Moi")).toEqual({});
	});
});

describe("compactLocalizedText", () => {
	it("trims and drops empty languages", () => {
		expect(compactLocalizedText({ fi: "  Moi ", sv: " ", en: "" })).toEqual({
			fi: "Moi",
		});
	});
});

describe("getLocalizedString", () => {
	const text = { fi: "Hei", sv: "Hej", en: "Hi" };

	it("prefers the requested locale", () => {
		expect(getLocalizedString(text, "sv")).toBe("Hej");
	});

	it("falls back to fi, then en, then sv, then anything", () => {
		expect(getLocalizedString({ ...text, sv: " " }, "sv")).toBe("Hei");
		expect(getLocalizedString({ en: "Hi", sv: "Hej" }, "fi")).toBe("Hi");
		expect(getLocalizedString({ sv: "Hej" }, "en")).toBe("Hej");
		expect(getLocalizedString({ de: "Hallo" }, "fi")).toBe("Hallo");
	});

	it("returns an empty string when nothing is there", () => {
		expect(getLocalizedString({}, "fi")).toBe("");
		expect(getLocalizedString(undefined, "fi")).toBe("");
	});
});
