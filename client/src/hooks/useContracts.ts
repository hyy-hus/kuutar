import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
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

/** Helper to extract localized text from contract JSONB fields with locale & language fallbacks */
export function getLocalizedText(
	field: unknown,
	locale = "fi",
	fallback = "-",
): string {
	if (!field) return fallback;
	if (typeof field === "string") return field;

	if (typeof field === "object" && field !== null) {
		const map = field as Record<string, string>;
		// Priority: Requested locale -> Finnish -> English -> Swedish -> First available key
		return (
			map[locale] ||
			map.fi ||
			map.en ||
			map.sv ||
			Object.values(map).find((val) => typeof val === "string") ||
			fallback
		);
	}

	return String(field);
}

/** Constructs full URL pointing to Axum's /contracts/static/{*s3_key} redirect endpoint */
export function getStaticContractUrl(
	s3KeyObj?: unknown,
	locale = "fi",
): string {
	if (!s3KeyObj) return "#";

	// Extract localized string (e.g. { fi: "contracts/68fa42e2-..." })
	const s3Key = getLocalizedText(s3KeyObj, locale, "");

	if (!s3Key || s3Key === "-") return "#";

	// If it's already an absolute URL, return directly
	if (s3Key.startsWith("http://") || s3Key.startsWith("https://")) {
		return s3Key;
	}

	const baseUrl =
		(api as { baseUrl?: string }).baseUrl || import.meta.env.VITE_API_URL || "";

	const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
	const cleanS3Key = s3Key.replace(/^\/+/, "");

	// 👈 encodeURIComponent turns 'contracts/' into 'contracts%2F'
	return `${cleanBaseUrl}/contracts/static/${encodeURIComponent(cleanS3Key)}`;
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
			if (error || !data)
				throw new Error(
					i18next.t(
						"sopimustenHakuEpaonnistui",
						"Sopimusten hakeminen epäonnistui.",
					),
				);
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
			if (error || !data)
				throw new Error(
					i18next.t(
						"sopimuksenHakuEpaonnistui",
						"Sopimuksen haku epäonnistui.",
					),
				);
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
				throw new Error(
					i18next.t(
						"latausosoitteenHakuEpaonnistui",
						"Latausosoitteen hakeminen epäonnistui.",
					),
				);
			return data;
		},
	});
}

export function useCreateContract() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateContractPayload) => {
			const { data, error } = await api.POST("/contracts", { body: payload });
			if (error || !data)
				throw new Error(
					i18next.t(
						"sopimuksenLuominenEpaonnistui",
						"Sopimuksen luominen epäonnistui.",
					),
				);
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
			if (error || !data)
				throw new Error(
					i18next.t(
						"sopimuksenPaivitysEpaonnistui",
						"Sopimuksen päivitys epäonnistui.",
					),
				);
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
				throw new Error(
					i18next.t(
						"latausosoitteenHakuEpaonnistui",
						"Latausosoitteen hakeminen epäonnistui.",
					),
				);
			return data.download_url;
		},
	});
}
