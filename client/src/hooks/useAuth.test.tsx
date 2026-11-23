import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "./useAuth";

const { post } = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("#/api/client", () => ({
	api: {
		GET: vi.fn(async () => ({
			data: undefined,
			error: {},
			response: new Response(null, { status: 401 }),
		})),
		POST: post,
	},
	refreshAuthToken: vi.fn(async () => false),
}));

function wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

function rateLimited(retryAfter: string) {
	post.mockResolvedValue({
		data: undefined,
		error: { error: "Liian monta yritystä. Yritä myöhemmin uudelleen." },
		response: new Response(null, {
			status: 429,
			headers: { "Retry-After": retryAfter },
		}),
	});
}

afterEach(() => post.mockReset());

describe("useAuth rate limits", () => {
	it("tells how long to wait when login is rate limited", async () => {
		rateLimited("540");
		const { result } = renderHook(() => useAuth(), { wrapper });
		await expect(
			result.current.login({ email: "user@example.test", password: "x" }),
		).rejects.toThrow("Too many attempts. Try again in 9 min.");
	});

	it("does the same for email code requests", async () => {
		rateLimited("30");
		const { result } = renderHook(() => useAuth(), { wrapper });
		await expect(
			result.current.requestOtp({ email: "user@example.test" }),
		).rejects.toThrow("Too many attempts. Try again in 1 min.");
	});

	it("keeps the server's message for other errors", async () => {
		post.mockResolvedValue({
			data: undefined,
			error: { error: "Invalid email or password" },
			response: new Response(null, { status: 401 }),
		});
		const { result } = renderHook(() => useAuth(), { wrapper });
		await expect(
			result.current.login({ email: "user@example.test", password: "x" }),
		).rejects.toThrow("Invalid email or password");
	});
});
