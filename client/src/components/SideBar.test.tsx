import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithProviders } from "#/test/render";
import { SideBar } from "./SideBar";

describe("SideBar", () => {
	it("shows labels and a quiet sign-in row when expanded", async () => {
		renderWithProviders(<SideBar theme="light" onThemeChange={() => {}} />);
		expect(await screen.findByRole("link", { name: "Calendar" })).toBeVisible();
		expect(screen.getByText("Calendar")).toBeVisible();
		expect(screen.getByRole("button", { name: "Log In" })).toBeVisible();
		expect(screen.queryByRole("button", { name: /collapse menu/i })).toBeNull();
	});

	it("keeps icon links with accessible names and drops text when collapsed", async () => {
		renderWithProviders(
			<SideBar collapsed theme="dark" onThemeChange={() => {}} />,
		);
		const link = await screen.findByRole("link", { name: "Calendar" });
		expect(link).toHaveTextContent("");
		expect(screen.queryByText("Calendar")).toBeNull();
		expect(screen.getByRole("button", { name: "Log In" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Settings" })).toBeVisible();
	});
});
