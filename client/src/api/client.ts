import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./schema";

const getBaseUrl = () => {
	if (import.meta.env.VITE_API_URL) {
		return import.meta.env.VITE_API_URL.replace(/\/$/, "");
	}

	if (typeof window !== "undefined" && window.location?.origin) {
		return window.location.origin;
	}

	return "http://127.0.0.1:8080";
};

const baseUrl = getBaseUrl();

export const api = createClient<paths>({ baseUrl });

// Helper to programmatically trigger the auth popover
export const openAuthDialog = () => {
	if (typeof window !== "undefined") {
		window.dispatchEvent(new CustomEvent("kuutar:open-auth-dialog"));
	}
};

let refreshPromise: Promise<boolean> | null = null;

/**
 * Silently refreshes the access token using the stored refresh token.
 * Updates localStorage with new access_token, refresh_token, and token_expires_at.
 */
export async function refreshAuthToken(): Promise<boolean> {
	if (typeof window === "undefined") return false;
	const refreshToken = localStorage.getItem("refresh_token");
	if (!refreshToken) return false;

	try {
		const res = await fetch(`${baseUrl}/auth/refresh`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ refresh_token: refreshToken }),
		});

		if (res.ok) {
			const data = await res.json();
			if (data.access_token) {
				localStorage.setItem("access_token", data.access_token);
				localStorage.setItem("refresh_token", data.refresh_token);
				const expiresAt = Date.now() + (data.expires_in ?? 900) * 1000;
				localStorage.setItem("token_expires_at", String(expiresAt));
				window.dispatchEvent(new CustomEvent("kuutar:token-refreshed"));
				return true;
			}
		}
	} catch (e) {
		console.error("Token refresh failed", e);
	}

	localStorage.removeItem("access_token");
	localStorage.removeItem("refresh_token");
	localStorage.removeItem("token_expires_at");
	return false;
}

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
		// If 401 occurs on non-auth requests, attempt silent refresh once and retry
		if (response.status === 401 && !request.url.includes("/auth/")) {
			if (!refreshPromise) {
				refreshPromise = refreshAuthToken().finally(() => {
					refreshPromise = null;
				});
			}

			const refreshed = await refreshPromise;
			if (refreshed) {
				const newToken = localStorage.getItem("access_token");
				const headers = new Headers(request.headers);
				if (newToken) {
					headers.set("Authorization", `Bearer ${newToken}`);
				}

				const targetUrl = request.url.startsWith("http")
					? request.url
					: new URL(request.url, baseUrl).toString();

				return fetch(targetUrl, {
					method: request.method,
					headers,
					body: request.body,
					// @ts-expect-error duplex required for streaming request bodies in modern fetch specs
					duplex: "half",
				});
			}
		}
		return response;
	},
};

api.use(authMiddleware);
