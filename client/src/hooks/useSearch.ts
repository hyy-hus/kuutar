// src/hooks/useSearch.ts
import { useQuery } from "@tanstack/react-query";
import { api } from "#/api/client";
import type { components } from "#/api/schema";
import { currentYearRange } from "#/utils/calendarUtils";
import { useResources } from "./useResorces";

export type Reservation = components["schemas"]["Reservation"];

export function useSearch(query: string) {
	const { data: resources = [] } = useResources();

	const reservationsQuery = useQuery({
		queryKey: ["search", "reservations", query],
		queryFn: async () => {
			if (!query.trim()) return [];
			const { start, end } = currentYearRange();
			const { data, error } = await api.GET("/reservations", {
				params: {
					query: {
						start_date: start.toISOString(),
						end_date: end.toISOString(),
					},
				},
			});
			if (error || !data) return [];
			return data;
		},
		enabled: query.trim().length > 0,
		staleTime: 1000 * 30,
	});

	const cleanQuery = query.toLowerCase().trim();

	const matchedResources = cleanQuery
		? resources.filter((res) => res.name.toLowerCase().includes(cleanQuery))
		: [];

	const matchedReservations = cleanQuery
		? (reservationsQuery.data ?? []).filter(
				(res) =>
					res.title.toLowerCase().includes(cleanQuery) ||
					res.description?.toLowerCase().includes(cleanQuery),
			)
		: [];

	return {
		resources: matchedResources,
		reservations: matchedReservations,
		isLoading: reservationsQuery.isLoading,
	};
}
