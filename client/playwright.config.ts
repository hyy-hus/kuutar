import { defineConfig, devices } from "@playwright/test";

const API_PORT = process.env.E2E_API_PORT ?? "3100";
const CLIENT_PORT = process.env.E2E_CLIENT_PORT ?? "5174";
const AUTH_FILE = "e2e/.auth/admin.json";

// e2e runs its own server (own database, port 3100) and client (port 5174),
// so a running dev setup on 3000/5173 is left alone.
export default defineConfig({
	testDir: "./e2e",
	fullyParallel: false,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	reporter: process.env.CI ? [["github"], ["html"]] : "list",
	use: {
		baseURL: `http://localhost:${CLIENT_PORT}`,
		// The UI picks its language from the browser, so tests run in English
		locale: "en-US",
		trace: "on-first-retry",
	},
	projects: [
		{ name: "setup", testMatch: /auth\.setup\.ts/ },
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"], storageState: AUTH_FILE },
			dependencies: ["setup"],
		},
	],
	webServer: [
		{
			command: "./e2e/start-server.sh",
			url: `http://127.0.0.1:${API_PORT}/health`,
			timeout: 300_000,
			reuseExistingServer: false,
			stderr: "pipe",
		},
		{
			command: `pnpm exec vite dev --port ${CLIENT_PORT} --strictPort`,
			url: `http://localhost:${CLIENT_PORT}`,
			// Overrides VITE_API_URL from .env, which points at the dev server
			env: { VITE_API_URL: `http://127.0.0.1:${API_PORT}` },
			reuseExistingServer: false,
		},
	],
});
