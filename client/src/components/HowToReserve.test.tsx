import { fireEvent, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import { HowToReserve } from "./HowToReserve";

describe("HowToReserve", () => {
	beforeEach(() => localStorage.clear());

	it("shows three steps without a dismiss button for guests", () => {
		renderWithProviders(<HowToReserve />);
		expect(screen.getAllByRole("listitem")).toHaveLength(3);
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("can be dismissed and stays hidden", () => {
		const { unmount } = renderWithProviders(<HowToReserve dismissible />);
		fireEvent.click(screen.getByRole("button"));
		expect(screen.queryByRole("list")).toBeNull();
		unmount();
		renderWithProviders(<HowToReserve dismissible />);
		expect(screen.queryByRole("list")).toBeNull();
	});
});
