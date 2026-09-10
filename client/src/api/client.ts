// src/api/client.ts
import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

const getBaseUrl = () => {
	// 1. Use VITE_API_URL directly if provided (strip trailing slash)
	if (import.meta.env.VITE_API_URL) {
		return import.meta.env.VITE_API_URL.replace(/\/$/, "");
	}

	// 2. Fallback to current origin for production without VITE_API_URL
	if (typeof window !== "undefined" && window.location?.origin) {
		return window.location.origin;
	}

	// 3. Fallback for local development
	return "http://127.0.0.1:3000";
};

const baseUrl = getBaseUrl();

export const api = createClient<paths>({
	baseUrl,
});

const authMiddleware: Middleware = {
	async onRequest({ request }) {
		if (typeof window !== "undefined") {
			const token = localStorage.getItem("access_token");
			if (token) {
				request.headers.set("Authorization", `Bearer ${token}`);
			}
		}
		return request;
	},

	async onResponse({ request, response }) {
		// If request fails with 401 and isn't already trying to login/refresh
		if (response.status === 401 && !request.url.includes("/auth/")) {
			const refreshToken = localStorage.getItem("refresh_token");

			if (refreshToken) {
				try {
					// Request refresh endpoint directly under baseUrl
					const res = await fetch(`${baseUrl}/auth/refresh`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ refresh_token: refreshToken }),
					});

					if (res.ok) {
						const data = await res.json();
						localStorage.setItem("access_token", data.access_token);
						localStorage.setItem("refresh_token", data.refresh_token);

						const targetUrl = request.url.startsWith("http")
							? request.url
							: new URL(request.url, baseUrl).toString();

						const headers = new Headers(request.headers);
						headers.set("Authorization", `Bearer ${data.access_token}`);

						return fetch(targetUrl, {
							method: request.method,
							headers,
							body: request.body,
							// @ts-expect-error duplex required for streaming request bodies in modern fetch specs
							duplex: "half",
						});
					}
				} catch {
					localStorage.removeItem("access_token");
					localStorage.removeItem("refresh_token");
				}
			}
		}

		return response;
	},
};

api.use(authMiddleware);
