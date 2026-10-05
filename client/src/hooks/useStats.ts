import { useQuery } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";
import { useMe } from "#/hooks/useAuth";
import type { StatsRange } from "#/utils/statsUtils";

export type StatsResponse = components["schemas"]["StatsResponse"];
export type PublicStats = components["schemas"]["PublicStats"];
export type MyStats = components["schemas"]["MyStats"];
export type AdminStats = components["schemas"]["AdminStats"];
export type MonthlyStat = components["schemas"]["MonthlyStat"];
export type TopResourceStat = components["schemas"]["TopResourceStat"];

export const statsKeys = {
	all: ["stats"] as const,
	summary: (range: StatsRange, viewer: string) =>
		[...statsKeys.all, "summary", range, viewer] as const,
};

export function useStats(range: StatsRange) {
	const me = useMe();

	return useQuery({
		// The response differs per viewer, so keep their caches apart
		queryKey: statsKeys.summary(range, me.data?.id ?? "guest"),
		enabled: !me.isLoading,
		queryFn: async () => {
			const { data, error } = await api.GET("/stats", {
				params: { query: { range } },
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"tilastojenHakuEpaonnistui",
						"Tilastojen haku epäonnistui.",
					),
				);
			return data;
		},
		staleTime: 1000 * 60 * 5, // Cache stats for 5 minutes
	});
}
