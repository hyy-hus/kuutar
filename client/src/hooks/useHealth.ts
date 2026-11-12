// client/src/hooks/useHealth.ts
import { useQuery } from "@tanstack/react-query";
import i18next from "i18next";
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
			try {
				const { data, error, response } = await api.GET("/health");
				if (error || !data || !response.ok) {
					console.error(
						"Healthcheck failed with status:",
						response?.status,
						error,
					);
					throw new Error(
						i18next.t(
							"jarjestelmatilanHakuEpaonnistui",
							"Järjestelmätilan haku epäonnistui.",
						),
					);
				}
				console.log("Healthcheck success:", data);
				return data;
			} catch (err) {
				console.error("Healthcheck network/CORS error:", err);
				throw err;
			}
		},
		// No polling: an open tab would keep the scale-to-zero API container awake. The
		// status refreshes when the page is opened again or the window regains focus.
		staleTime: 1000 * 60 * 5,
		retry: 1,
	});
}
