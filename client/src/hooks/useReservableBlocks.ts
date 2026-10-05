import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";

export type ReservableBlockOccurrence =
	components["schemas"]["ReservableBlockOccurrence"];
export type ReservableBlock = components["schemas"]["ReservableBlock"];
export type ReservableBlockWithOccurrences =
	components["schemas"]["ReservableBlockWithOccurrences"];
export type CreateReservableBlockPayload =
	components["schemas"]["CreateReservableBlockPayload"];
export type UpdateReservableBlockPayload =
	components["schemas"]["UpdateReservableBlockPayload"];

export const reservableBlockKeys = {
	all: ["reservable-blocks"] as const,
	lists: () => [...reservableBlockKeys.all, "list"] as const,
	list: (params: {
		start_date?: string;
		end_date?: string;
		resource_id?: string;
	}) => [...reservableBlockKeys.lists(), params] as const,
	details: () => [...reservableBlockKeys.all, "detail"] as const,
	detail: (id: string) => [...reservableBlockKeys.details(), id] as const,
};

export function useReservableBlocks(
	params?: {
		start_date?: string;
		end_date?: string;
		resource_id?: string;
	},
	options?: { enabled?: boolean },
) {
	return useQuery({
		queryKey: reservableBlockKeys.list(params ?? {}),
		queryFn: async () => {
			const { data, error } = await api.GET("/reservable-blocks", {
				params: { query: params },
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"varausjaksojenHakuEpaonnistui",
						"Varausjaksojen lataus epäonnistui.",
					),
				);
			return data as ReservableBlockWithOccurrences[];
		},
		enabled: options?.enabled ?? true,
	});
}

export function useReservableBlock(id: string) {
	return useQuery({
		queryKey: reservableBlockKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/reservable-blocks/{id}", {
				params: { path: { id } },
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"varausjaksonHakuEpaonnistui",
						"Varausjakson lataus epäonnistui.",
					),
				);
			return data as ReservableBlockWithOccurrences;
		},
		enabled: Boolean(id),
	});
}

export function useCreateReservableBlock() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateReservableBlockPayload) => {
			const { data, error } = await api.POST("/reservable-blocks", {
				body: payload,
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"varausjaksonLuontiEpaonnistui",
						"Varausjakson luonti epäonnistui.",
					),
				);
			return data as ReservableBlockWithOccurrences;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: reservableBlockKeys.all });
		},
	});
}

export function useUpdateReservableBlock() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			payload,
		}: {
			id: string;
			payload: UpdateReservableBlockPayload;
		}) => {
			const { data, error } = await api.PATCH("/reservable-blocks/{id}", {
				params: { path: { id } },
				body: payload,
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"varausjaksonPaivitysEpaonnistui",
						"Varausjakson päivitys epäonnistui.",
					),
				);
			return data as ReservableBlockWithOccurrences;
		},
		onSuccess: (updated) => {
			queryClient.setQueryData(reservableBlockKeys.detail(updated.id), updated);
			queryClient.invalidateQueries({ queryKey: reservableBlockKeys.all });
		},
	});
}

export function useDeleteReservableBlock() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await api.DELETE("/reservable-blocks/{id}", {
				params: { path: { id } },
			});
			if (error)
				throw new Error(
					i18next.t(
						"varausjaksonPoistoEpaonnistui",
						"Varausjakson poisto epäonnistui.",
					),
				);
			return id;
		},
		onSuccess: (id) => {
			queryClient.removeQueries({ queryKey: reservableBlockKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: reservableBlockKeys.all });
		},
	});
}
