import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";

// Schema Type Exports
export type Reservation = components["schemas"]["Reservation"];
export type ReservationWithOccurrences =
	components["schemas"]["ReservationWithOccurrences"];
export type CreateReservationPayload =
	components["schemas"]["CreateReservationPayload"];
export type UpdateReservationPayload =
	components["schemas"]["UpdateReservationPayload"];
export type ReservationStatus = components["schemas"]["ReservationStatus"];
export type CreateOccurrencePayload =
	components["schemas"]["CreateOccurrencePayload"];
export type Occurrence = components["schemas"]["Occurrence"];

// Batch Import/Export Schema Types
export type PortableReservationImport =
	components["schemas"]["PortableReservationImport"];
export type PortableOccurrenceImport =
	components["schemas"]["PortableOccurrenceImport"];
export type BatchImportReport = components["schemas"]["BatchImportReport"];

export interface ReservationFilterParams {
	startDate: string;
	endDate: string;
	resourceId?: string;
	status?: ReservationStatus;
}

export const reservationKeys = {
	all: ["reservations"] as const,
	lists: () => [...reservationKeys.all, "list"] as const,
	list: (params: ReservationFilterParams) =>
		[...reservationKeys.lists(), params] as const,
	myLists: () => [...reservationKeys.all, "my-list"] as const,
	myList: (params: ReservationFilterParams) =>
		[...reservationKeys.myLists(), params] as const,
	details: () => [...reservationKeys.all, "detail"] as const,
	detail: (id: string) => [...reservationKeys.details(), id] as const,
};

/** Fetches all active reservations within date/resource filters (Public calendar or Admin dashboard) */
export function useReservations(params: ReservationFilterParams) {
	return useQuery({
		queryKey: reservationKeys.list(params),
		queryFn: async () => {
			const { data, error } = await api.GET("/reservations", {
				params: {
					query: {
						start_date: params.startDate,
						end_date: params.endDate,
						resource_id: params.resourceId,
						status: params.status,
					},
				},
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"varaustenHakuEpaonnistui",
						"Varauksien hakeminen epäonnistui.",
					),
				);
			return data;
		},
		enabled: Boolean(params.startDate && params.endDate),
		staleTime: 1000 * 60 * 5,
	});
}

/** Strictly fetches ONLY the authenticated user's own reservations */
export function useMyReservations(params: ReservationFilterParams) {
	const hasValidDates = Boolean(
		params?.startDate &&
			params?.endDate &&
			params.startDate.trim() !== "" &&
			params.endDate.trim() !== "",
	);

	return useQuery({
		queryKey: reservationKeys.myList(params),
		queryFn: async () => {
			const { data, error } = await api.GET("/reservations/me", {
				params: {
					query: {
						start_date: params.startDate,
						end_date: params.endDate,
						resource_id: params.resourceId || undefined,
						status: params.status || undefined,
					},
				},
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"omienVaraustenHakuEpaonnistui",
						"Omien varausten hakeminen epäonnistui.",
					),
				);
			return data;
		},
		enabled: hasValidDates,
		staleTime: 1000 * 60 * 5,
	});
}

export function useReservation(id: string) {
	return useQuery({
		queryKey: reservationKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/reservations/{id}", {
				params: { path: { id } },
			});
			if (error || !data)
				throw new Error(
					i18next.t("varaustaEiLoytynyt", "Varauksen tiedot ei löytynyt."),
				);
			return data;
		},
		enabled: Boolean(id),
	});
}

export function useCreateReservation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateReservationPayload) => {
			const { data, error } = await api.POST("/reservations", {
				body: payload,
			});

			if (error) {
				const message =
					typeof error === "object" && error !== null && "message" in error
						? (error as { message: string }).message
						: i18next.t(
								"varauksenLuominenEponnistui",
								"Varauksen luominen epäonnistui.",
							);
				throw new Error(message);
			}
			if (!data)
				throw new Error(
					i18next.t(
						"varauksenLuominenEponnistui",
						"Varauksen luominen epäonnistui.",
					),
				);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: reservationKeys.all });
		},
	});
}

export function useUpdateReservation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			payload,
		}: {
			id: string;
			payload: UpdateReservationPayload;
		}) => {
			const { data, error } = await api.PATCH("/reservations/{id}", {
				params: { path: { id } },
				body: payload,
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"varauksenPaivitysEpaonnistui",
						"Varauksen päivitys epäonnistui.",
					),
				);
			return data;
		},
		onSuccess: (updatedReservation) => {
			queryClient.setQueryData(
				reservationKeys.detail(updatedReservation.id),
				updatedReservation,
			);
			queryClient.invalidateQueries({ queryKey: reservationKeys.all });
		},
	});
}

export function useDeleteReservation() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await api.DELETE("/reservations/{id}", {
				params: { path: { id } },
			});
			if (error)
				throw new Error(
					i18next.t(
						"varauksenPoistoEpaonnistui",
						"Varauksen poisto epäonnistui.",
					),
				);
			return id;
		},
		onSuccess: (deletedId) => {
			queryClient.removeQueries({
				queryKey: reservationKeys.detail(deletedId),
			});
			queryClient.invalidateQueries({ queryKey: reservationKeys.all });
		},
	});
}

export function useCheckConflicts() {
	return useMutation({
		mutationFn: async (occurrences: CreateOccurrencePayload[]) => {
			const { data, error } = await api.POST("/reservations/check-conflicts", {
				body: occurrences,
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"ristiriitojenTarkistusEpaonnistui",
						"Ristiriitojen tarkistus epäonnistui.",
					),
				);
			return data;
		},
	});
}

export function useBatchImportReservations() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: PortableReservationImport[]) => {
			const { data, error } = await api.POST("/reservations/batch-import", {
				body: payload,
			});

			if (error || !data) {
				const message =
					typeof error === "object" && error !== null && "message" in error
						? String((error as { message: unknown }).message)
						: i18next.t(
								"varaustenMassatuontiEpaonnistui",
								"Varausten massatuonti epäonnistui.",
							);
				throw new Error(message);
			}

			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: reservationKeys.all });
		},
	});
}

export function exportReservationsToPortableJson(
	reservations: ReservationWithOccurrences[],
	resourceMap: Map<string, string>,
) {
	const exportData: PortableReservationImport[] = reservations.map((res) => ({
		user_email: res.user_email ?? undefined,
		title: res.title,
		description: res.description ?? undefined,
		admin_notes: res.admin_notes ?? undefined,
		contact_person: res.contact_person ?? undefined,
		contact_email: res.contact_email ?? undefined,
		contact_phone: res.contact_phone ?? undefined,
		rrule: res.rrule ?? undefined,
		status: res.status,
		occurrences: (res.occurrences || []).map((occ) => ({
			resource_name: resourceMap.get(occ.resource_id) || "Tuntematon",
			start_time: occ.start_time,
			end_time: occ.end_time,
		})),
	}));

	const jsonStr = JSON.stringify(exportData, null, 2);
	const blob = new Blob([jsonStr], { type: "application/json" });
	const url = URL.createObjectURL(blob);

	const link = document.createElement("a");
	link.href = url;
	link.download = `reservations-export-${new Date().toISOString().slice(0, 10)}.json`;
	link.click();
	URL.revokeObjectURL(url);
}
