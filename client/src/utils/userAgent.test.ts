import { describe, expect, it } from "vitest";
import { describeUserAgent } from "./userAgent";

describe("describeUserAgent", () => {
	it("recognises common browsers and systems", () => {
		expect(
			describeUserAgent(
				"Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0",
			),
		).toBe("Firefox · Linux");
		expect(
			describeUserAgent(
				"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128.0 Safari/537.36 Edg/128.0",
			),
		).toBe("Edge · Windows");
		expect(
			describeUserAgent(
				"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
			),
		).toBe("Safari · iOS");
		expect(
			describeUserAgent(
				"Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/128.0 Mobile Safari/537.36",
			),
		).toBe("Chrome · Android");
	});

	it("returns null when there is nothing to show", () => {
		expect(describeUserAgent(null)).toBeNull();
		expect(describeUserAgent("")).toBeNull();
	});
});
