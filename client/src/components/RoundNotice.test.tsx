import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { makeRound } from "#/test/fixtures";
import { renderWithProviders } from "#/test/render";
import { RoundNotice } from "./RoundNotice";

const round = makeRound({ name: "Spring round" });

describe("RoundNotice", () => {
	it("tells what to do while applications are open", () => {
		renderWithProviders(
			<RoundNotice round={round} now={new Date("2026-11-11T09:00:00Z")} />,
		);
		expect(screen.getByText(/each block you pick is one application/i));
		expect(
			screen.getByRole("link", { name: "Apply for a block" }),
		).toHaveAttribute("href", expect.stringContaining(round.resource_ids[0]));
	});

	it("doesn't preselect when the round has several resources", () => {
		renderWithProviders(
			<RoundNotice
				round={{ ...round, resource_ids: ["a", "b"] }}
				now={new Date("2026-11-11T09:00:00Z")}
			/>,
		);
		expect(
			screen.getByRole("link", { name: "Apply for a block" }),
		).not.toHaveAttribute("href", expect.stringContaining("resource_ids"));
	});

	it("announces an upcoming round without an apply button", () => {
		renderWithProviders(
			<RoundNotice round={round} now={new Date("2026-11-01T09:00:00Z")} />,
		);
		expect(screen.getByText(/Applications are open/));
		expect(
			screen.queryByRole("link", { name: "Apply for a block" }),
		).toBeNull();
		expect(screen.getByRole("link", { name: "Open round" }));
	});

	it("renders nothing for a completed round", () => {
		const { container } = renderWithProviders(
			<RoundNotice round={{ ...round, status: "completed" }} />,
		);
		expect(container).toBeEmptyDOMElement();
	});
});
