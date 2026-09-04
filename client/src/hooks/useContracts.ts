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
            if (error || !data) throw new Error('Sopimusten hakeminen epäonnistui.')
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
            if (error || !data) throw new Error('Sopimuksen haku epäonnistui.')
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
            if (error || !data) throw new Error('Sopimuksen luominen epäonnistui.')
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contractKeys.all })
        },
    })
}

export function useUpdateContract() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateContractPayload }) => {
            const { data, error } = await api.PATCH('/contracts/{id}', {
                params: { path: { id } },
                body: payload,
            })
            if (error || !data) throw new Error('Sopimuksen päivitys epäonnistui.')
            return data
        },
        onSuccess: (updatedContract) => {
            queryClient.setQueryData(
                contractKeys.detail(updatedContract.id),
                updatedContract
            )
            queryClient.invalidateQueries({ queryKey: contractKeys.all })
        },
    })
}
