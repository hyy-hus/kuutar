import { screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { WeekView } from "./WeekView";

describe("WeekView", () => {
	beforeEach(() => {
		vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
		vi.setSystemTime(new Date(2026, 10, 11, 14, 30)); // Wednesday
	});
	afterEach(() => vi.useRealTimers());

	it("draws the now-line in today's column only", () => {
		renderWithProviders(
			<WeekView
				start={new Date(2026, 10, 9)}
				days={5}
				hourHeightRem={5}
				events={[]}
			/>,
		);
		const lines = screen.getAllByTestId("now-line");
		expect(lines).toHaveLength(1);
		// Wednesday is the third day column (the first grid column holds the hours)
		expect(lines[0].parentElement).toHaveStyle({ gridColumn: "4" });
	});

	it("draws no now-line when today is out of view", () => {
		renderWithProviders(
			<WeekView
				start={new Date(2026, 10, 16)}
				days={5}
				hourHeightRem={5}
				events={[]}
			/>,
		);
		expect(screen.queryByTestId("now-line")).toBeNull();
	});
});
