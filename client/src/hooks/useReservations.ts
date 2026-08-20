import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/client'
import type { components } from '#/api/schema'

export type Reservation = components['schemas']['Reservation']
export type ReservationWithOccurrences = components['schemas']['ReservationWithOccurrences']
export type CreateReservationPayload = components['schemas']['CreateReservationPayload']
export type UpdateReservationPayload = components['schemas']['UpdateReservationPayload']
export type ReservationStatus = components['schemas']['ReservationStatus']

export const reservationKeys = {
    all: ['reservations'] as const,
    lists: () => [...reservationKeys.all, 'list'] as const,
    details: () => [...reservationKeys.all, 'detail'] as const,
    detail: (id: string) => [...reservationKeys.details(), id] as const,
}

export function useReservations() {
    return useQuery({
        queryKey: reservationKeys.lists(),
        queryFn: async () => {
            const { data, error } = await api.GET('/reservations')
            if (error || !data) throw new Error('Varauksien hakeminen epäonnistui.')
            return data
        },
        staleTime: 1000 * 60 * 5,
    })
}

export function useReservation(id: string) {
    return useQuery({
        queryKey: reservationKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.GET('/reservations/{id}', {
                params: { path: { id } },
            })
            if (error || !data) throw new Error('Varauksen tiedot ei löytynyt.')
            return data
        },
        enabled: Boolean(id),
    })
}

export function useCreateReservation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: CreateReservationPayload) => {
            const { data, error } = await api.POST('/reservations', { body: payload })
            if (error || !data) throw new Error('Varauksen luominen epäonnistui.')
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: reservationKeys.lists() })
        },
    })
}

export function useUpdateReservation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateReservationPayload }) => {
            const { data, error } = await api.PATCH('/reservations/{id}', {
                params: { path: { id } },
                body: payload,
            })
            if (error || !data) throw new Error('Varauksen päivitys epäonnistui.')
            return data
        },
        onSuccess: (updatedReservation) => {
            queryClient.setQueryData(reservationKeys.detail(updatedReservation.id), updatedReservation)
            queryClient.invalidateQueries({ queryKey: reservationKeys.lists() })
        },
    })
}

export function useDeleteReservation() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.DELETE('/reservations/{id}', {
                params: { path: { id } },
            })
            if (error) throw new Error('Varauksen poisto epäonnistui.')
            return id
        },
        onSuccess: (deletedId) => {
            queryClient.removeQueries({ queryKey: reservationKeys.detail(deletedId) })
            queryClient.invalidateQueries({ queryKey: reservationKeys.lists() })
        },
    })
}

export type CreateOccurrencePayload = components['schemas']['CreateOccurrencePayload']
export type Occurrence = components['schemas']['Occurrence']

export function useCheckConflicts() {
    return useMutation({
        mutationFn: async (occurrences: CreateOccurrencePayload[]) => {
            const { data, error } = await api.POST('/reservations/check-conflicts', {
                body: occurrences,
            })
            if (error || !data) throw new Error('Ristiriitojen tarkistus epäonnistui.')
            return data
        },
    })
}
