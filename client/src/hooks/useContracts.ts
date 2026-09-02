import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/client'
import type { components } from '#/api/schema'

export type Contract = components['schemas']['Contract']
export type CreateContractPayload = components['schemas']['CreateContract']
export type UpdateContractPayload = components['schemas']['UpdateContract']

export const contractKeys = {
    all: ['contracts'] as const,
    lists: () => [...contractKeys.all, 'list'] as const,
    details: () => [...contractKeys.all, 'detail'] as const,
    detail: (id: string) => [...contractKeys.details(), id] as const,
}

export function useContracts() {
    return useQuery({
        queryKey: contractKeys.lists(),
        queryFn: async () => {
            const { data, error } = await api.GET('/contracts')
            if (error || !data) throw new Error('Sopimuspohjien hakeminen epäonnistui.')
            return data
        },
        staleTime: 1000 * 60 * 5,
    })
}

export function useContract(id: string) {
    return useQuery({
        queryKey: contractKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.GET('/contracts/{id}', {
                params: { path: { id } },
            })
            if (error || !data) throw new Error('Sopimuspohjan tiedot eivät löytyneet.')
            return data
        },
        enabled: Boolean(id),
    })
}

export function useCreateContract() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: CreateContractPayload) => {
            const { data, error } = await api.POST('/contracts', { body: payload })
            if (error || !data) throw new Error('Sopimuspohjan luominen epäonnistui.')
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contractKeys.lists() })
        },
    })
}

// Inside src/hooks/useContracts.ts

export function useUpdateContract() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            id,
            payload,
        }: {
            id: string
            payload: components['schemas']['UpdateContract']
        }) => {
            const { data, error } = await api.PATCH('/contracts/{id}', {
                params: { path: { id } },
                body: payload,
            })

            if (error) throw new Error('Sopimuspohjan päivitys epäonnistui.')
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['contracts'] })
        },
    })
}

export function useDeleteContract() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.DELETE('/contracts/{id}', {
                params: { path: { id } },
            })
            if (error) throw new Error('Sopimuspohjan poisto epäonnistui.')
            return id
        },
        onSuccess: (deletedId) => {
            queryClient.removeQueries({ queryKey: contractKeys.detail(deletedId) })
            queryClient.invalidateQueries({ queryKey: contractKeys.lists() })
        },
    })
}
