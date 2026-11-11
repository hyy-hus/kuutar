import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { SideBar } from "./SideBar";

describe("SideBar", () => {
	it("shows labels, the sign-in button and a language and theme switch when expanded", async () => {
		const onThemeChange = vi.fn();
		renderWithProviders(
			<SideBar theme="light" onThemeChange={onThemeChange} />,
		);
		expect(await screen.findByRole("link", { name: "Calendar" })).toBeVisible();
		expect(screen.getByText("Calendar")).toBeVisible();
		expect(screen.getByRole("button", { name: "Log In" })).toBeVisible();
		expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: /Dark/ }));
		expect(onThemeChange).toHaveBeenCalledWith("dark");
	});

	it("keeps icon links with accessible names and drops text when collapsed", async () => {
		renderWithProviders(
			<SideBar collapsed theme="dark" onThemeChange={() => {}} />,
		);
		const link = await screen.findByRole("link", { name: "Calendar" });
		expect(link).toHaveTextContent("");
		expect(screen.queryByText("Calendar")).toBeNull();
		expect(screen.getByRole("button", { name: "Log In" })).toBeVisible();
		expect(screen.getByRole("button", { name: "Language" })).toBeVisible();
	});
});
