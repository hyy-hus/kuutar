import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "#/api/client";
import type { components } from "#/api/schema";

export type Contract = components["schemas"]["Contract"];
export type CreateContractPayload = components["schemas"]["CreateContract"];
export type UpdateContractPayload = components["schemas"]["UpdateContract"];
export type PresignedUploadRequest =
	components["schemas"]["PresignedUploadRequest"];
export type PresignedUploadResponse =
	components["schemas"]["PresignedUploadResponse"];

export const contractKeys = {
	all: ["contracts"] as const,
	lists: () => [...contractKeys.all, "list"] as const,
	list: (params?: { resource_id?: string; active_only?: boolean }) =>
		[...contractKeys.lists(), params] as const,
	details: () => [...contractKeys.all, "detail"] as const,
	detail: (id: string) => [...contractKeys.details(), id] as const,
};

/** Helper to extract localized text from contract JSONB fields with locale fallback */
export function getLocalizedText(
	field: unknown,
	locale = "fi",
	fallback = "-",
): string {
	if (!field || typeof field !== "object") return fallback;
	const map = field as Record<string, string>;
	return map[locale] || map.fi || map.en || Object.values(map)[0] || fallback;
}

export function useContracts(params?: {
	resource_id?: string;
	active_only?: boolean;
}) {
	return useQuery({
		queryKey: contractKeys.list(params),
		queryFn: async () => {
			const { data, error } = await api.GET("/contracts", {
				params: { query: params },
			});
			if (error || !data) throw new Error("Sopimusten hakeminen epäonnistui.");
			return data;
		},
		staleTime: 1000 * 60 * 5,
	});
}

export function useContract(id: string) {
	return useQuery({
		queryKey: contractKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/contracts/{id}", {
				params: { path: { id } },
			});
			if (error || !data) throw new Error("Sopimuksen haku epäonnistui.");
			return data;
		},
		enabled: Boolean(id),
	});
}

export function usePresignUpload() {
	return useMutation({
		mutationFn: async (payload: PresignedUploadRequest) => {
			const { data, error } = await api.POST("/contracts/presign-upload", {
				body: payload,
			});
			if (error || !data)
				throw new Error("Latausosoitteen hakeminen epäonnistui.");
			return data;
		},
	});
}

export function useCreateContract() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateContractPayload) => {
			const { data, error } = await api.POST("/contracts", { body: payload });
			if (error || !data) throw new Error("Sopimuksen luominen epäonnistui.");
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: contractKeys.all });
		},
	});
}

export function useUpdateContract() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			payload,
		}: {
			id: string;
			payload: UpdateContractPayload;
		}) => {
			const { data, error } = await api.PATCH("/contracts/{id}", {
				params: { path: { id } },
				body: payload,
			});
			if (error || !data) throw new Error("Sopimuksen päivitys epäonnistui.");
			return data;
		},
		onSuccess: (updatedContract) => {
			queryClient.setQueryData(
				contractKeys.detail(updatedContract.id),
				updatedContract,
			);
			queryClient.invalidateQueries({ queryKey: contractKeys.all });
		},
	});
}

export function usePresignDownload() {
	return useMutation({
		mutationFn: async (s3Key: string) => {
			const { data, error } = await api.GET("/contracts/download", {
				params: { query: { s3_key: s3Key } },
			});
			if (error || !data)
				throw new Error("Latausosoitteen hakeminen epäonnistui.");
			return data.download_url;
		},
	});
}
