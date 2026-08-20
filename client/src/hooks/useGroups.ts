import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/client'
import type { components } from '#/api/schema'

export type Group = components['schemas']['Group']
export type CreateGroup = components['schemas']['CreateGroup']
export type UpdateGroup = components['schemas']['UpdateGroup']

export const groupKeys = {
    all: ['groups'] as const,
    lists: () => [...groupKeys.all, 'list'] as const,
    details: () => [...groupKeys.all, 'detail'] as const,
    detail: (id: string) => [...groupKeys.details(), id] as const,
}

export function useGroups() {
    return useQuery({
        queryKey: groupKeys.lists(),
        queryFn: async () => {
            const { data, error } = await api.GET('/groups')

            if (error || !data) {
                throw new Error('Ryhmien hakeminen epäonnistui.')
            }

            return data
        },
        staleTime: 1000 * 60 * 5,
    })
}

export function useGroup(id: string) {
    return useQuery({
        queryKey: groupKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.GET('/groups/{id}', {
                params: { path: { id } },
            })

            if (error || !data) {
                throw new Error('Ryhmän tiedot ei löytynyt.')
            }

            return data
        },
        enabled: Boolean(id),
    })
}

export function useCreateGroup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: CreateGroup) => {
            const { data, error } = await api.POST('/groups', {
                body: payload,
            })

            if (error || !data) {
                throw new Error('Ryhmän luominen epäonnistui.')
            }

            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
        },
    })
}

export function useUpdateGroup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateGroup }) => {
            const { data, error } = await api.PATCH('/groups/{id}', {
                params: { path: { id } },
                body: payload,
            })

            if (error || !data) {
                throw new Error('Ryhmän päivitys epäonnistui.')
            }

            return data
        },
        onSuccess: (updatedGroup) => {
            queryClient.setQueryData(groupKeys.detail(updatedGroup.id), updatedGroup)
            queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
        },
    })
}

export function useDeleteGroup() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.DELETE('/groups/{id}', {
                params: { path: { id } },
            })

            if (error) {
                throw new Error('Ryhmän poisto epäonnistui.')
            }

            return id
        },
        onSuccess: (deletedId) => {
            queryClient.removeQueries({ queryKey: groupKeys.detail(deletedId) })
            queryClient.invalidateQueries({ queryKey: groupKeys.lists() })
        },
    })
}
