import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, refreshAuthToken } from "#/api/client";
import type { components } from "#/api/schema";

type LoginPayload = components["schemas"]["LoginPayload"];
type RegisterPayload = components["schemas"]["RegisterPayload"];
type RefreshPayload = components["schemas"]["RefreshPayload"];
type RequestOtpPayload = components["schemas"]["RequestOtpPayload"];
type VerifyOtpPayload = components["schemas"]["VerifyOtpPayload"];

export const authKeys = {
	all: ["auth"] as const,
	me: () => [...authKeys.all, "me"] as const,
};

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity considered idle
const REFRESH_BUFFER_MS = 2 * 60 * 1000; // Refresh 2 minutes before expiration
const CHECK_INTERVAL_MS = 15 * 1000; // Check every 15 seconds

let lastUserActivity = typeof window !== "undefined" ? Date.now() : 0;

if (typeof window !== "undefined") {
	const recordActivity = () => {
		lastUserActivity = Date.now();
	};
	window.addEventListener("mousedown", recordActivity, { passive: true });
	window.addEventListener("keydown", recordActivity, { passive: true });
	window.addEventListener("scroll", recordActivity, { passive: true });
	window.addEventListener("touchstart", recordActivity, { passive: true });
}

/**
 * Tracks token expiration and silently refreshes the token before it expires,
 * provided the user is actively using the application.
 */
export function useSilentRefresh() {
	useEffect(() => {
		if (typeof window === "undefined") return;

		const checkAndRefresh = async () => {
			const token = localStorage.getItem("access_token");
			const refreshToken = localStorage.getItem("refresh_token");
			const expiresAtStr = localStorage.getItem("token_expires_at");

			if (!token || !refreshToken || !expiresAtStr) return;

			const expiresAt = Number.parseInt(expiresAtStr, 10);
			if (Number.isNaN(expiresAt)) return;

			const now = Date.now();
			const timeUntilExpiry = expiresAt - now;
			const isUserActive = now - lastUserActivity < IDLE_TIMEOUT_MS;

			// Proactively refresh if token expires soon and user is active
			if (timeUntilExpiry < REFRESH_BUFFER_MS && isUserActive) {
				await refreshAuthToken();
			}
		};

		const interval = setInterval(checkAndRefresh, CHECK_INTERVAL_MS);

		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				lastUserActivity = Date.now();
				checkAndRefresh();
			}
		};
		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);
}

export async function fetchMe() {
	// 1. Short-circuit immediately if no token exists in local storage
	const token =
		typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

	if (!token) {
		return null;
	}

	// 2. Fetch user profile if token is present
	const { data, error } = await api.GET("/users/me");

	if (error || !data) {
		// 3. Clear invalid/expired token so subsequent checks short-circuit
		if (typeof window !== "undefined") {
			localStorage.removeItem("access_token");
			localStorage.removeItem("refresh_token");
			localStorage.removeItem("token_expires_at");
		}
		return null;
	}

	return data;
}

export function useMe() {
	return useQuery({
		queryKey: authKeys.me(),
		queryFn: fetchMe,
		retry: false,
		staleTime: 1000 * 60 * 5,
	});
}

export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
	const { data: user, isLoading } = useMe();
	return {
		isAdmin: user?.role === "admin",
		isLoading,
	};
}

export function useAuth() {
	const queryClient = useQueryClient();
	const meQuery = useMe();

	// Run silent background refresh
	useSilentRefresh();

	const handleTokenSuccess = (tokens?: components["schemas"]["AuthTokens"]) => {
		if (tokens?.access_token) {
			localStorage.setItem("access_token", tokens.access_token);
			localStorage.setItem("refresh_token", tokens.refresh_token);
			const expiresAt = Date.now() + (tokens.expires_in ?? 900) * 1000;
			localStorage.setItem("token_expires_at", String(expiresAt));
		}
		queryClient.invalidateQueries({ queryKey: authKeys.me() });
	};

	const loginMutation = useMutation({
		mutationFn: async (payload: LoginPayload) => {
			const { data, error } = await api.POST("/auth/login", { body: payload });
			if (error) {
				const msg =
					(error as { error?: string })?.error ||
					"Virheellinen sähköposti tai salasana.";
				throw new Error(msg);
			}
			return data;
		},
		onSuccess: handleTokenSuccess,
	});

	const requestOtpMutation = useMutation({
		mutationFn: async (payload: RequestOtpPayload) => {
			const { error } = await api.POST("/auth/otp/request", { body: payload });
			if (error) {
				const msg =
					(error as { error?: string })?.error ||
					"Sähköpostikoodin lähetys epäonnistui.";
				throw new Error(msg);
			}
		},
	});

	const verifyOtpMutation = useMutation({
		mutationFn: async (payload: VerifyOtpPayload) => {
			const { data, error } = await api.POST("/auth/otp/verify", {
				body: payload,
			});
			if (error) {
				const msg =
					(error as { error?: string })?.error ||
					"Virheellinen tai vanhentunut koodi.";
				throw new Error(msg);
			}
			return data;
		},
		onSuccess: handleTokenSuccess,
	});

	const registerMutation = useMutation({
		mutationFn: async (payload: RegisterPayload) => {
			const { data, error } = await api.POST("/auth/register", {
				body: payload,
			});
			if (error) {
				const msg =
					(error as { error?: string })?.error ||
					"Käyttäjätilin luonti epäonnistui.";
				throw new Error(msg);
			}
			return data;
		},
		onSuccess: handleTokenSuccess,
	});

	const logoutMutation = useMutation({
		mutationFn: async () => {
			const refreshToken = localStorage.getItem("refresh_token") || "";
			if (refreshToken) {
				const payload: RefreshPayload = { refresh_token: refreshToken };
				await api.POST("/auth/logout", { body: payload });
			}
		},
		onSettled: () => {
			localStorage.removeItem("access_token");
			localStorage.removeItem("refresh_token");
			localStorage.removeItem("token_expires_at");
			queryClient.setQueryData(authKeys.me(), null);
			queryClient.clear();
		},
	});

	return {
		user: meQuery.data ?? null,
		isLoading: meQuery.isLoading,
		isAuthenticated: Boolean(meQuery.data),

		login: loginMutation.mutateAsync,
		requestOtp: requestOtpMutation.mutateAsync,
		verifyOtp: verifyOtpMutation.mutateAsync,
		register: registerMutation.mutateAsync,
		logout: logoutMutation.mutateAsync,

		isLoggingIn: loginMutation.isPending,
		isRequestingOtp: requestOtpMutation.isPending,
		isVerifyingOtp: verifyOtpMutation.isPending,
		isRegistering: registerMutation.isPending,
		isLoggingOut: logoutMutation.isPending,

		loginError: loginMutation.error?.message,
		requestOtpError: requestOtpMutation.error?.message,
		verifyOtpError: verifyOtpMutation.error?.message,
		registerError: registerMutation.error?.message,
	};
}
