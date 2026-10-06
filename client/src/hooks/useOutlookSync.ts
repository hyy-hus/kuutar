import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";

export type SyncStatus = components["schemas"]["SyncStatus"];
export type SyncLogEntry = components["schemas"]["SyncLogEntry"];
export type SyncRunReport = components["schemas"]["SyncRunReport"];

export const outlookSyncKeys = {
	status: ["outlook-sync", "status"] as const,
};

export function useOutlookSyncStatus() {
	return useQuery({
		queryKey: outlookSyncKeys.status,
		queryFn: async () => {
			const { data, error } = await api.GET("/outlook-sync/status");
			if (error || !data) {
				throw new Error(
					i18next.t(
						"outlookTilanHakuEpaonnistui",
						"Outlook-synkronoinnin tilan hakeminen epäonnistui.",
					),
				);
			}
			return data;
		},
		refetchInterval: 30_000,
	});
}

export function useRunOutlookSync() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async () => {
			const { data, error } = await api.POST("/outlook-sync/run");
			if (error || !data) {
				throw new Error(
					i18next.t(
						"outlookSynkronointiEpaonnistui",
						"Outlook-synkronointi epäonnistui.",
					),
				);
			}
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: outlookSyncKeys.status });
			// Imports change what the calendar shows
			queryClient.invalidateQueries({ queryKey: ["reservations"] });
		},
	});
}
