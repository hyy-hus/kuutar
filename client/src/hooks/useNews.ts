import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";

export type News = components["schemas"]["News"];
export type NewsSummary = components["schemas"]["NewsSummary"];
export type NewsInput = components["schemas"]["NewsInput"];

export const newsKeys = {
	all: ["news"] as const,
	lists: () => [...newsKeys.all, "list"] as const,
	highlights: () => [...newsKeys.all, "highlights"] as const,
	unreadCount: () => [...newsKeys.all, "unread-count"] as const,
	details: () => [...newsKeys.all, "detail"] as const,
	detail: (id: string) => [...newsKeys.details(), id] as const,
};

/** News visible to the viewer, newest first; admins also get drafts and scheduled items */
export function useNewsList() {
	return useQuery({
		queryKey: newsKeys.lists(),
		queryFn: async () => {
			const { data, error } = await api.GET("/news");
			if (error || !data) {
				throw new Error(
					i18next.t(
						"tiedotteidenHakuEpaonnistui",
						"Tiedotteiden hakeminen epäonnistui.",
					),
				);
			}
			return data;
		},
	});
}

/** Highlighted news for the home page (unread ones for signed-in users) */
export function useNewsHighlights() {
	return useQuery({
		queryKey: newsKeys.highlights(),
		queryFn: async () => {
			const { data, error } = await api.GET("/news/highlights");
			if (error || !data) {
				throw new Error(
					i18next.t(
						"tiedotteidenHakuEpaonnistui",
						"Tiedotteiden hakeminen epäonnistui.",
					),
				);
			}
			return data;
		},
	});
}

/**
 * Unread count for the sidebar badge. No polling: it refreshes on navigation after 5 minutes
 * and whenever the user reads something, so an idle tab does not keep the database awake.
 */
export function useUnreadNewsCount({ enabled }: { enabled: boolean }) {
	return useQuery({
		queryKey: newsKeys.unreadCount(),
		queryFn: async () => {
			const { data, error } = await api.GET("/news/unread-count");
			if (error || !data) {
				throw new Error(
					i18next.t(
						"tiedotteidenHakuEpaonnistui",
						"Tiedotteiden hakeminen epäonnistui.",
					),
				);
			}
			return data.count;
		},
		enabled,
		staleTime: 1000 * 60 * 5,
	});
}

export function useNewsItem(id: string) {
	return useQuery({
		queryKey: newsKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/news/{id}", {
				params: { path: { id } },
			});
			if (error || !data) {
				throw new Error(
					i18next.t("tiedotettaEiLoytynyt", "Tiedotetta ei löytynyt."),
				);
			}
			return data;
		},
		enabled: Boolean(id),
	});
}

export function useCreateNews() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: NewsInput) => {
			const { data, error } = await api.POST("/news", { body: payload });
			if (error || !data) {
				throw new Error(
					i18next.t(
						"tiedotteenTallennusEpaonnistui",
						"Tiedotteen tallentaminen epäonnistui.",
					),
				);
			}
			return data;
		},
		onSuccess: (created) => {
			queryClient.setQueryData(newsKeys.detail(created.id), created);
			queryClient.invalidateQueries({ queryKey: newsKeys.all });
		},
	});
}

export function useUpdateNews() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({ id, payload }: { id: string; payload: NewsInput }) => {
			const { data, error } = await api.PUT("/news/{id}", {
				params: { path: { id } },
				body: payload,
			});
			if (error || !data) {
				throw new Error(
					i18next.t(
						"tiedotteenTallennusEpaonnistui",
						"Tiedotteen tallentaminen epäonnistui.",
					),
				);
			}
			return data;
		},
		onSuccess: (updated) => {
			queryClient.setQueryData(newsKeys.detail(updated.id), updated);
			queryClient.invalidateQueries({ queryKey: newsKeys.all });
		},
	});
}

export function useDeleteNews() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await api.DELETE("/news/{id}", {
				params: { path: { id } },
			});
			if (error) {
				throw new Error(
					i18next.t(
						"tiedotteenPoistoEpaonnistui",
						"Tiedotteen poistaminen epäonnistui.",
					),
				);
			}
			return id;
		},
		onSuccess: (id) => {
			queryClient.removeQueries({ queryKey: newsKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: newsKeys.all });
		},
	});
}

/** Marks one item read and updates the cached read state right away */
export function useMarkNewsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await api.POST("/news/{id}/read", {
				params: { path: { id } },
			});
			if (error) throw new Error("mark read failed");
			return id;
		},
		onSuccess: (id) => {
			queryClient.setQueryData<News>(newsKeys.detail(id), (item) =>
				item ? { ...item, is_read: true } : item,
			);
			queryClient.setQueryData<NewsSummary[]>(newsKeys.lists(), (items) =>
				items?.map((item) =>
					item.id === id ? { ...item, is_read: true } : item,
				),
			);
			queryClient.setQueryData<NewsSummary[]>(newsKeys.highlights(), (items) =>
				items?.filter((item) => item.id !== id),
			);
			queryClient.invalidateQueries({ queryKey: newsKeys.unreadCount() });
		},
	});
}

export function useMarkAllNewsRead() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { error } = await api.POST("/news/read-all");
			if (error) {
				throw new Error(
					i18next.t(
						"merkitseminenEpaonnistui",
						"Luetuksi merkitseminen epäonnistui.",
					),
				);
			}
		},
		onSuccess: () => {
			queryClient.setQueryData(newsKeys.unreadCount(), 0);
			queryClient.invalidateQueries({ queryKey: newsKeys.all });
		},
	});
}
