import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "#/api/client";
import type { components } from "#/api/schema";

export type RestrictionOccurrence =
	components["schemas"]["RestrictionOccurrence"];
export type Restriction = components["schemas"]["Restriction"];
export type RestrictionWithOccurrences =
	components["schemas"]["RestrictionWithOccurrences"];
export type CreateRestrictionPayload =
	components["schemas"]["CreateRestrictionPayload"];
export type UpdateRestrictionPayload =
	components["schemas"]["UpdateRestrictionPayload"];

export const restrictionKeys = {
	all: ["restrictions"] as const,
	lists: () => [...restrictionKeys.all, "list"] as const,
	list: (params: {
		start_date?: string;
		end_date?: string;
		resource_id?: string;
	}) => [...restrictionKeys.lists(), params] as const,
	details: () => [...restrictionKeys.all, "detail"] as const,
	detail: (id: string) => [...restrictionKeys.details(), id] as const,
};

export function useRestrictions(params?: {
	start_date?: string;
	end_date?: string;
	resource_id?: string;
}) {
	return useQuery({
		queryKey: restrictionKeys.list(params ?? {}),
		queryFn: async () => {
			const { data, error } = await api.GET("/restrictions", {
				params: { query: params },
			});
			if (error || !data) throw new Error("Rajoitusten lataus epäonnistui.");
			return data as RestrictionWithOccurrences[];
		},
	});
}

export function useRestriction(id: string) {
	return useQuery({
		queryKey: restrictionKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/restrictions/{id}", {
				params: { path: { id } },
			});
			if (error || !data) throw new Error("Rajoituksen lataus epäonnistui.");
			return data as RestrictionWithOccurrences;
		},
		enabled: Boolean(id),
	});
}

export function useCreateRestriction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateRestrictionPayload) => {
			const { data, error } = await api.POST("/restrictions", {
				body: payload,
			});
			if (error || !data) throw new Error("Rajoituksen luonti epäonnistui.");
			return data as RestrictionWithOccurrences;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: restrictionKeys.all });
		},
	});
}

export function useUpdateRestriction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			payload,
		}: {
			id: string;
			payload: UpdateRestrictionPayload;
		}) => {
			const { data, error } = await api.PATCH("/restrictions/{id}", {
				params: { path: { id } },
				body: payload,
			});
			if (error || !data) throw new Error("Rajoituksen päivitys epäonnistui.");
			return data as RestrictionWithOccurrences;
		},
		onSuccess: (updated) => {
			queryClient.setQueryData(restrictionKeys.detail(updated.id), updated);
			queryClient.invalidateQueries({ queryKey: restrictionKeys.all });
		},
	});
}

export function useDeleteRestriction() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await api.DELETE("/restrictions/{id}", {
				params: { path: { id } },
			});
			if (error) throw new Error("Rajoituksen poisto epäonnistui.");
			return id;
		},
		onSuccess: (id) => {
			queryClient.removeQueries({ queryKey: restrictionKeys.detail(id) });
			queryClient.invalidateQueries({ queryKey: restrictionKeys.all });
		},
	});
}
