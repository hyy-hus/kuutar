import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "#/test/render";
import { SideBar } from "./SideBar";

// Responses by path; anything else fails like an unreachable API
const { responses } = vi.hoisted(() => ({
	responses: {} as Record<string, unknown>,
}));
vi.mock("#/api/client", () => ({
	api: {
		GET: vi.fn(async (path: string) =>
			path in responses
				? {
						data: responses[path],
						error: undefined,
						response: new Response(null, { status: 200 }),
					}
				: {
						data: undefined,
						error: {},
						response: new Response(null, { status: 503 }),
					},
		),
	},
	openAuthDialog: vi.fn(),
}));

function signIn(unread: number) {
	localStorage.setItem("access_token", "test-token");
	responses["/users/me"] = {
		id: "u1",
		email: "user@example.test",
		name: "Test User",
		role: "user",
	};
	responses["/news/unread-count"] = { count: unread };
}

afterEach(() => {
	for (const key of Object.keys(responses)) delete responses[key];
});

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

	it("shows news to guests without an unread badge", async () => {
		renderWithProviders(<SideBar theme="light" onThemeChange={() => {}} />);
		const link = await screen.findByRole("link", { name: "News" });
		expect(link).toHaveTextContent(/^News$/);
	});

	it("shows the unread news count to signed-in users", async () => {
		signIn(3);
		renderWithProviders(<SideBar theme="light" onThemeChange={() => {}} />);
		const link = await screen.findByRole("link", { name: "News, 3 unread" });
		expect(link).toHaveTextContent("3");
	});

	it("caps large counts and keeps the count in the collapsed rail's name", async () => {
		signIn(120);
		renderWithProviders(
			<SideBar collapsed theme="light" onThemeChange={() => {}} />,
		);
		const link = await screen.findByRole("link", {
			name: "News, 120 unread",
		});
		expect(link).toHaveTextContent("");
	});

	it("hides the badge when everything is read", async () => {
		signIn(0);
		renderWithProviders(<SideBar theme="light" onThemeChange={() => {}} />);
		expect(await screen.findByText("Test User")).toBeVisible();
		expect(screen.getByRole("link", { name: "News" })).toHaveTextContent(
			/^News$/,
		);
	});
});
