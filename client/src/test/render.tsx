import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	createMemoryHistory,
	createRouter,
	RouterContextProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { routeTree } from "../routeTree.gen";

interface RenderOptions {
	/** Initial URL of the in-memory router */
	url?: string;
}

/**
 * Renders a component with what the app normally provides: a query client (no retries, so
 * failures surface at once) and the router, so `Link` and router hooks work. Only the
 * context is provided; routes are not matched or rendered.
 */
export function renderWithProviders(
	ui: ReactElement,
	{ url = "/" }: RenderOptions = {},
) {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false, staleTime: Infinity } },
	});
	const router = createRouter({
		routeTree,
		context: { queryClient },
		history: createMemoryHistory({ initialEntries: [url] }),
	});
	return {
		queryClient,
		router,
		...render(
			<QueryClientProvider client={queryClient}>
				<RouterContextProvider router={router}>{ui}</RouterContextProvider>
			</QueryClientProvider>,
		),
	};
}
