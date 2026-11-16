import { defineConfig, devices } from "@playwright/test";

const API_PORT = process.env.E2E_API_PORT ?? "3100";
const CLIENT_PORT = process.env.E2E_CLIENT_PORT ?? "5174";
export const API_URL = `http://127.0.0.1:${API_PORT}`;

/**
 * The moment the run starts. The browser clock is pinned to it, and its Helsinki date is the
 * dataset's "today" (the seeder's --anchor). It has to be the real date: the API checks times
 * against its own clock (scheduled news, round windows, ...), so data anchored to a fixed past
 * date drifts out of step with it as time passes.
 */
export const PINNED_NOW = new Date();
export const ANCHOR_DATE = new Intl.DateTimeFormat("en-CA", {
	timeZone: "Europe/Helsinki",
}).format(PINNED_NOW);

// Generates the showcase screenshots in docs/screenshots from the synthetic mock dataset. Uses
// its own throwaway database and ports, like the e2e tests. Run with `pnpm screenshots`.
export default defineConfig({
	testDir: "./e2e/screenshots",
	fullyParallel: false,
	workers: 1,
	reporter: "list",
	timeout: 120_000,
	use: {
		baseURL: `http://localhost:${CLIENT_PORT}`,
		locale: "fi-FI",
		timezoneId: "Europe/Helsinki",
	},
	projects: [
		{
			name: "pages",
			use: {
				...devices["Desktop Chrome"],
				viewport: { width: 1440, height: 900 },
			},
		},
	],
	webServer: [
		{
			command: "./e2e/start-server.sh",
			url: `http://127.0.0.1:${API_PORT}/health`,
			timeout: 600_000,
			reuseExistingServer: false,
			stderr: "pipe",
			env: { E2E_SEED: "1", E2E_SEED_ANCHOR: ANCHOR_DATE },
		},
		{
			command: `pnpm exec vite dev --port ${CLIENT_PORT} --strictPort`,
			url: `http://localhost:${CLIENT_PORT}`,
			env: { VITE_API_URL: `http://127.0.0.1:${API_PORT}` },
			reuseExistingServer: false,
		},
	],
});
