import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";
import { userKeys } from "#/hooks/useUsers";

export type Session = components["schemas"]["SessionInfo"];

export const sessionKeys = {
	mine: ["auth", "sessions"] as const,
};

const revokeError = () =>
	new Error(
		i18next.t(
			"istunnonPaattaminenEpaonnistui",
			"Istunnon päättäminen epäonnistui.",
		),
	);

/** Active sessions of the signed-in user */
export function useMySessions() {
	return useQuery({
		queryKey: sessionKeys.mine,
		queryFn: async () => {
			const { data, error } = await api.GET("/auth/sessions");
			if (error || !data) throw new Error("Failed to fetch sessions");
			return data;
		},
	});
}

export function useRevokeMySession() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (sessionId: string) => {
			const { error } = await api.DELETE("/auth/sessions/{session_id}", {
				params: { path: { session_id: sessionId } },
			});
			if (error) throw revokeError();
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionKeys.mine }),
	});
}

/** Ends every session except the one making the request */
export function useLogoutOtherSessions() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { error } = await api.POST("/auth/logout-others");
			if (error) throw revokeError();
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: sessionKeys.mine }),
	});
}

/** Active sessions of any user (admin only) */
export function useUserSessions(userId: string) {
	return useQuery({
		queryKey: userKeys.sessions(userId),
		queryFn: async () => {
			const { data, error } = await api.GET("/users/{id}/sessions", {
				params: { path: { id: userId } },
			});
			if (error || !data) throw new Error("Failed to fetch sessions");
			return data;
		},
		enabled: Boolean(userId),
	});
}

export function useRevokeUserSession(userId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (sessionId: string) => {
			const { error } = await api.DELETE("/users/{id}/sessions/{session_id}", {
				params: { path: { id: userId, session_id: sessionId } },
			});
			if (error) throw revokeError();
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: userKeys.sessions(userId) }),
	});
}

export function useRevokeAllUserSessions(userId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { error } = await api.DELETE("/users/{id}/sessions", {
				params: { path: { id: userId } },
			});
			if (error) throw revokeError();
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: userKeys.sessions(userId) }),
	});
}
