import { describe, expect, it } from "vitest";
import { stripOutlookPrefix } from "./reservationTitle";

describe("stripOutlookPrefix", () => {
	it("removes the prefix", () => {
		expect(stripOutlookPrefix("Outlook: Team meeting")).toBe("Team meeting");
		expect(stripOutlookPrefix("outlook:Team meeting")).toBe("Team meeting");
	});
	it("leaves other titles alone", () => {
		expect(stripOutlookPrefix("Team meeting")).toBe("Team meeting");
		expect(stripOutlookPrefix("Outlook migration")).toBe("Outlook migration");
	});
	it("keeps a title that is only the prefix", () => {
		expect(stripOutlookPrefix("Outlook:")).toBe("Outlook:");
	});
});
