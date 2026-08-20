import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/client'
import type { components } from '#/api/schema'

// Extract Schema Types from OpenAPI spec
export type Resource = components['schemas']['Resource']
export type CreateResource = components['schemas']['CreateResource']
export type UpdateResource = components['schemas']['UpdateResource']

// 1. Query Key Factory for Resources
export const resourceKeys = {
    all: ['resources'] as const,
    lists: () => [...resourceKeys.all, 'list'] as const,
    details: () => [...resourceKeys.all, 'detail'] as const,
    detail: (id: string) => [...resourceKeys.details(), id] as const,
}

/**
 * Fetch all active resources
 */
export function useResources() {
    return useQuery({
        queryKey: resourceKeys.lists(),
        queryFn: async () => {
            const { data, error } = await api.GET('/resources')

            if (error || !data) {
                throw new Error('Resurssien hakeminen epäonnistui.')
            }

            return data
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    })
}

/**
 * Fetch a single resource by ID
 */
export function useResource(id: string) {
    return useQuery({
        queryKey: resourceKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.GET('/resources/{id}', {
                params: { path: { id } },
            })

            if (error || !data) {
                throw new Error('Resurssin tiedot ei löytynyt.')
            }

            return data
        },
        enabled: Boolean(id),
    })
}

/**
 * Create a new resource
 */
export function useCreateResource() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: CreateResource) => {
            const { data, error } = await api.POST('/resources', {
                body: payload,
            })

            if (error || !data) {
                throw new Error('Resurssin luominen epäonnistui.')
            }

            return data
        },
        onSuccess: () => {
            // Refresh resource list
            queryClient.invalidateQueries({ queryKey: resourceKeys.lists() })
        },
    })
}

/**
 * Update an existing resource
 */
export function useUpdateResource() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateResource }) => {
            const { data, error } = await api.PATCH('/resources/{id}', {
                params: { path: { id } },
                body: payload,
            })

            if (error || !data) {
                throw new Error('Resurssin päivitys epäonnistui.')
            }

            return data
        },
        onSuccess: (updatedResource) => {
            // Update specific detail cache and invalidate list
            queryClient.setQueryData(resourceKeys.detail(updatedResource.id), updatedResource)
            queryClient.invalidateQueries({ queryKey: resourceKeys.lists() })
        },
    })
}

/**
 * Soft-delete a resource
 */
export function useDeleteResource() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.DELETE('/resources/{id}', {
                params: { path: { id } },
            })

            if (error) {
                throw new Error('Resurssin poisto epäonnistui.')
            }

            return id
        },
        onSuccess: (deletedId) => {
            // Remove detail entry from cache and refresh list
            queryClient.removeQueries({ queryKey: resourceKeys.detail(deletedId) })
            queryClient.invalidateQueries({ queryKey: resourceKeys.lists() })
        },
    })
}
