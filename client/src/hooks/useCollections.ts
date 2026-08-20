// src/hooks/useCollections.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/client'
import type { components } from '#/api/schema'

// Extract Schema Types from OpenAPI spec
export type Collection = components['schemas']['Collection']
export type CreateCollection = components['schemas']['CreateCollection']
export type UpdateCollection = components['schemas']['UpdateCollection']

// 1. Query Key Factory for Collections
export const collectionKeys = {
    all: ['collections'] as const,
    lists: () => [...collectionKeys.all, 'list'] as const,
    details: () => [...collectionKeys.all, 'detail'] as const,
    detail: (id: string) => [...collectionKeys.details(), id] as const,
}

/**
 * Fetch all active collections
 */
export function useCollections() {
    return useQuery({
        queryKey: collectionKeys.lists(),
        queryFn: async () => {
            const { data, error } = await api.GET('/collections')

            if (error || !data) {
                throw new Error('Kokoelmien hakeminen epäonnistui.')
            }

            return data
        },
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    })
}

/**
 * Fetch a single collection by ID
 */
export function useCollection(id: string) {
    return useQuery({
        queryKey: collectionKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.GET('/collections/{id}', {
                params: { path: { id } },
            })

            if (error || !data) {
                throw new Error('Kokoelman tiedot ei löytynyt.')
            }

            return data
        },
        enabled: Boolean(id),
    })
}

/**
 * Create a new collection
 */
export function useCreateCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: CreateCollection) => {
            const { data, error } = await api.POST('/collections', {
                body: payload,
            })

            if (error || !data) {
                throw new Error('Kokoelman luominen epäonnistui.')
            }

            return data
        },
        onSuccess: () => {
            // Refresh collection list
            queryClient.invalidateQueries({ queryKey: collectionKeys.lists() })
        },
    })
}

/**
 * Update an existing collection
 */
export function useUpdateCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateCollection }) => {
            const { data, error } = await api.PATCH('/collections/{id}', {
                params: { path: { id } },
                body: payload,
            })

            if (error || !data) {
                throw new Error('Kokoelman päivitys epäonnistui.')
            }

            return data
        },
        onSuccess: (updatedCollection) => {
            // Update specific detail cache and invalidate list
            queryClient.setQueryData(collectionKeys.detail(updatedCollection.id), updatedCollection)
            queryClient.invalidateQueries({ queryKey: collectionKeys.lists() })
        },
    })
}

/**
 * Soft-delete a collection
 */
export function useDeleteCollection() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.DELETE('/collections/{id}', {
                params: { path: { id } },
            })

            if (error) {
                throw new Error('Kokoelman poisto epäonnistui.')
            }

            return id
        },
        onSuccess: (deletedId) => {
            // Remove detail entry from cache and refresh list
            queryClient.removeQueries({ queryKey: collectionKeys.detail(deletedId) })
            queryClient.invalidateQueries({ queryKey: collectionKeys.lists() })
        },
    })
}
