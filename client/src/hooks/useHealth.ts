// client/src/hooks/useHealth.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "#/api/client";
import type { components } from "#/api/schema";

export type HealthResponse = components["schemas"]["HealthStatus"];

export const healthKeys = {
	all: ["health"] as const,
	status: () => [...healthKeys.all, "status"] as const,
};

export function useHealth() {
	return useQuery({
		queryKey: healthKeys.status(),
		queryFn: async () => {
			const { data, error } = await api.GET("/health");
			if (error || !data) throw new Error("Järjestelmätilan haku epäonnistui.");
			return data;
		},
		refetchInterval: 1000 * 60, // Refetch health status every minute
		staleTime: 1000 * 30,
	});
}
