import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { ImpersonationBanner } from "./ImpersonationBanner";

describe("ImpersonationBanner", () => {
	it("says whose session this is and returns on click", () => {
		const onStop = vi.fn();
		renderWithProviders(
			<ImpersonationBanner
				user={{ name: "Maija Meikäläinen", email: "maija@example.test" }}
				onStop={onStop}
			/>,
		);
		expect(
			screen.getByText(
				"You are acting as Maija Meikäläinen (maija@example.test).",
			),
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Return to your own session" }),
		);
		expect(onStop).toHaveBeenCalledOnce();
	});

	it("falls back to the email when the user has no name", () => {
		renderWithProviders(
			<ImpersonationBanner
				user={{ name: "", email: "nameless@example.test" }}
				onStop={() => {}}
			/>,
		);
		expect(screen.getByText("You are acting as nameless@example.test."));
	});
});
