import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useHealth } from "./useHealth";

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("#/api/client", () => ({ api: { GET: get } }));

function wrapper({ children }: { children: ReactNode }) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	});
	return (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	);
}

describe("useHealth", () => {
	beforeEach(() => {
		vi.useFakeTimers({ shouldAdvanceTime: true });
		get.mockResolvedValue({
			data: { status: "ok" },
			error: undefined,
			response: new Response(null, { status: 200 }),
		});
		vi.spyOn(console, "log").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
		get.mockReset();
	});

	it("fetches once and does not poll while the tab stays open", async () => {
		const { result } = renderHook(() => useHealth(), { wrapper });
		await waitFor(() => expect(result.current.isSuccess).toBe(true));

		await act(async () => {
			await vi.advanceTimersByTimeAsync(10 * 60 * 1000);
		});

		expect(get).toHaveBeenCalledTimes(1);
		expect(get).toHaveBeenCalledWith("/health");
	});
});
