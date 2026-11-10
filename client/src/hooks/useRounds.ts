import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";
import { reservationKeys } from "#/hooks/useReservations";

export type Round = components["schemas"]["Round"];
export type CreateRoundPayload = components["schemas"]["CreateRoundPayload"];
export type UpdateRoundPayload = components["schemas"]["UpdateRoundPayload"];
export type RoundApplication = components["schemas"]["RoundApplication"];
export type Allocation = components["schemas"]["Allocation"];
export type AllocationProposal = components["schemas"]["AllocationProposal"];

export const roundKeys = {
	all: ["rounds"] as const,
	list: () => [...roundKeys.all, "list"] as const,
	open: () => [...roundKeys.all, "open"] as const,
	detail: (id: string) => [...roundKeys.all, "detail", id] as const,
	applications: (id: string) => [...roundKeys.all, "applications", id] as const,
	allocation: (id: string) => [...roundKeys.all, "allocation", id] as const,
};

const loadFailed = () =>
	new Error(
		i18next.t(
			"kierrostenHakuEpaonnistui",
			"Varauskierrosten lataus epäonnistui.",
		),
	);

const actionFailed = () =>
	new Error(
		i18next.t(
			"kierrostoimintoEpaonnistui",
			"Toiminto epäonnistui. Tarkista tiedot ja yritä uudelleen.",
		),
	);

/** Admin: all rounds */
export function useRounds() {
	return useQuery({
		queryKey: roundKeys.list(),
		queryFn: async () => {
			const { data, error } = await api.GET("/rounds");
			if (error || !data) throw loadFailed();
			return data;
		},
	});
}

/** Rounds the signed-in user's group can still apply to */
export function useOpenRounds(options?: { enabled?: boolean }) {
	return useQuery({
		queryKey: roundKeys.open(),
		queryFn: async () => {
			const { data, error } = await api.GET("/rounds/open");
			if (error || !data) throw loadFailed();
			return data;
		},
		enabled: options?.enabled ?? true,
		staleTime: 1000 * 30,
	});
}

export function useRound(id: string) {
	return useQuery({
		queryKey: roundKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/rounds/{id}", {
				params: { path: { id } },
			});
			if (error || !data) throw loadFailed();
			return data;
		},
		enabled: Boolean(id),
	});
}

export function useRoundApplications(id: string) {
	return useQuery({
		queryKey: roundKeys.applications(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/rounds/{id}/applications", {
				params: { path: { id } },
			});
			if (error || !data) throw loadFailed();
			return data;
		},
		enabled: Boolean(id),
	});
}

export function useSavedAllocation(id: string) {
	return useQuery({
		queryKey: roundKeys.allocation(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/rounds/{id}/allocation", {
				params: { path: { id } },
			});
			if (error || !data) throw loadFailed();
			return data;
		},
		enabled: Boolean(id),
	});
}

export function useCreateRound() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (payload: CreateRoundPayload) => {
			const { data, error } = await api.POST("/rounds", { body: payload });
			if (error || !data) throw actionFailed();
			return data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: roundKeys.all }),
	});
}

export function useUpdateRound() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async ({
			id,
			payload,
		}: {
			id: string;
			payload: UpdateRoundPayload;
		}) => {
			const { data, error } = await api.PATCH("/rounds/{id}", {
				params: { path: { id } },
				body: payload,
			});
			if (error || !data) throw actionFailed();
			return data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: roundKeys.all }),
	});
}

export function useDeleteRound() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await api.DELETE("/rounds/{id}", {
				params: { path: { id } },
			});
			if (error) throw actionFailed();
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: roundKeys.all }),
	});
}

/** The caller's own ranking of their applications for one resource, best first */
export function useSetPriorities(roundId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (body: {
			resource_id: string;
			reservation_ids: string[];
		}) => {
			const { error } = await api.PUT("/rounds/{id}/priorities", {
				params: { path: { id: roundId } },
				body,
			});
			if (error) throw actionFailed();
		},
		onSuccess: () =>
			queryClient.invalidateQueries({ queryKey: reservationKeys.all }),
	});
}

/** Randomized proposal; nothing is saved */
export function useProposeAllocation(roundId: string) {
	return useMutation({
		mutationFn: async (seed?: number) => {
			const { data, error } = await api.POST("/rounds/{id}/allocate", {
				params: { path: { id: roundId } },
				body: seed === undefined ? undefined : { seed },
			});
			if (error || !data) throw actionFailed();
			return data;
		},
	});
}

export function useSaveAllocation(roundId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async (reservationIds: string[]) => {
			const { data, error } = await api.PUT("/rounds/{id}/allocation", {
				params: { path: { id: roundId } },
				body: { reservation_ids: reservationIds },
			});
			if (error || !data) throw actionFailed();
			return data;
		},
		onSuccess: () => queryClient.invalidateQueries({ queryKey: roundKeys.all }),
	});
}

export function useCompleteRound(roundId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: async () => {
			const { data, error } = await api.POST("/rounds/{id}/complete", {
				params: { path: { id: roundId } },
			});
			if (error || !data) throw actionFailed();
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: roundKeys.all });
			queryClient.invalidateQueries({ queryKey: reservationKeys.all });
		},
	});
}
