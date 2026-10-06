import { Layers } from "lucide-react";
import { describe, expect, it } from "vitest";
import { COLLECTION_ICONS, getCollectionIcon } from "./collectionIcons";

describe("getCollectionIcon", () => {
	it("resolves every allowlisted key to a component", () => {
		for (const key of COLLECTION_ICONS) {
			expect(getCollectionIcon(key)).toBeDefined();
		}
	});

	it("falls back to Layers for missing or unknown keys", () => {
		expect(getCollectionIcon(undefined)).toBe(Layers);
		expect(getCollectionIcon(null)).toBe(Layers);
		expect(getCollectionIcon("nope")).toBe(Layers);
		expect(getCollectionIcon("toString")).toBe(Layers);
	});
});
