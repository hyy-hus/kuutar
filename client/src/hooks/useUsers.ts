import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '#/api/client'
import type { components } from '#/api/schema'

export type User = components['schemas']['User']
export type CreateUserPayload = components['schemas']['CreateUser']
export type UpdateUserPayload = components['schemas']['UpdateUser']
export type RegisterPayload = components['schemas']['RegisterPayload']

export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    details: () => [...userKeys.all, 'detail'] as const,
    detail: (id: string) => [...userKeys.details(), id] as const,
    sessions: (id: string) => [...userKeys.detail(id), 'sessions'] as const,
}

export function useUsers() {
    return useQuery({
        queryKey: userKeys.lists(),
        queryFn: async () => {
            const { data, error } = await api.GET('/users')
            if (error || !data) throw new Error('Käyttäjien hakeminen epäonnistui.')
            return data
        },
        staleTime: 1000 * 60 * 5,
    })
}

export function useUser(id: string) {
    return useQuery({
        queryKey: userKeys.detail(id),
        queryFn: async () => {
            const { data, error } = await api.GET('/users/{id}', {
                params: { path: { id } },
            })
            if (error || !data) throw new Error('Käyttäjän tiedot ei löytynyt.')
            return data
        },
        enabled: Boolean(id),
    })
}

/** Admin endpoint to create a user directly */
export function useCreateUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: CreateUserPayload) => {
            const { data, error } = await api.POST('/users', { body: payload })
            if (error || !data) throw new Error('Käyttäjän luominen epäonnistui.')
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() })
        },
    })
}

/** Public sign-up / registration */
export function useRegisterUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (payload: RegisterPayload) => {
            const { data, error } = await api.POST('/auth/register', { body: payload })
            if (error || !data) throw new Error('Rekisteröityminen epäonnistui.')
            return data
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: userKeys.lists() })
        },
    })
}

export function useUpdateUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({ id, payload }: { id: string; payload: UpdateUserPayload }) => {
            const { data, error } = await api.PATCH('/users/{id}', {
                params: { path: { id } },
                body: payload,
            })
            if (error || !data) throw new Error('Käyttäjän päivitys epäonnistui.')
            return data
        },
        onSuccess: (updatedUser) => {
            queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser)
            queryClient.invalidateQueries({ queryKey: userKeys.lists() })
        },
    })
}

export function useDeleteUser() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (id: string) => {
            const { error } = await api.DELETE('/users/{id}', {
                params: { path: { id } },
            })
            if (error) throw new Error('Käyttäjän poisto epäonnistui.')
            return id
        },
        onSuccess: (deletedId) => {
            queryClient.removeQueries({ queryKey: userKeys.detail(deletedId) })
            queryClient.invalidateQueries({ queryKey: userKeys.lists() })
        },
    })
}
