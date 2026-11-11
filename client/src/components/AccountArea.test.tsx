import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { AccountMenu } from "./AccountArea";

const user = { name: "Test User", email: "test.user@example.test" };

function setup(props: Partial<Parameters<typeof AccountMenu>[0]> = {}) {
	const handlers = {
		onThemeChange: vi.fn(),
		onLogout: vi.fn(),
		onSignIn: vi.fn(),
	};
	renderWithProviders(
		<AccountMenu user={user} theme="light" {...handlers} {...props} />,
	);
	return handlers;
}

describe("AccountMenu", () => {
	it("shows name and email in one row and keeps the menu closed", () => {
		setup();
		expect(screen.getByText("Test User")).toBeVisible();
		expect(screen.getByText("test.user@example.test")).toBeVisible();
		expect(screen.queryByRole("button", { name: "Log Out" })).toBeNull();
	});

	it("opens a menu with profile, language, theme and sign-out", async () => {
		const handlers = setup();
		await userEvent.click(screen.getByRole("button", { name: /Test User/ }));
		expect(screen.getByRole("link", { name: "My profile" })).toBeVisible();
		expect(screen.getByRole("button", { name: "EN" })).toHaveAttribute(
			"aria-pressed",
			"true",
		);
		await userEvent.click(screen.getByRole("button", { name: /Dark/ }));
		expect(handlers.onThemeChange).toHaveBeenCalledWith("dark");
		await userEvent.click(screen.getByRole("button", { name: "Log Out" }));
		expect(handlers.onLogout).toHaveBeenCalled();
	});

	it("opens the same menu from the avatar in the rail", async () => {
		setup({ collapsed: true });
		expect(screen.queryByText("test.user@example.test")).toBeNull();
		await userEvent.click(screen.getByRole("button", { name: /Test User/ }));
		expect(screen.getByRole("link", { name: "My profile" })).toBeVisible();
	});

	it("shows only a sign-in row and a settings button to guests", async () => {
		const handlers = setup({ user: null });
		await userEvent.click(screen.getByRole("button", { name: "Log In" }));
		expect(handlers.onSignIn).toHaveBeenCalled();
		await userEvent.click(screen.getByRole("button", { name: "Settings" }));
		expect(screen.getByRole("button", { name: /Light/ })).toBeVisible();
	});
});
