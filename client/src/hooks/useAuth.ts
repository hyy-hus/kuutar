import { api } from "#/api/client";
import type { components } from "#/api/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type LoginPayload = components['schemas']['LoginPayload']
type RegisterPayload = components['schemas']['RegisterPayload']
type RefreshPayload = components['schemas']['RefreshPayload']

export const authKeys = {
    all: ['auth'] as const,
    me: () => [...authKeys.all, 'me'] as const,
}

/**
 * Hook to retrieve and cache the currently authenticated user profile.
 */
export function useMe() {
    return useQuery({
        queryKey: authKeys.me(),
        queryFn: async () => {
            const { data, error } = await api.GET('/users/me')

            if (error || !data) return null

            return data
        },
        retry: false,
        staleTime: 1000 * 60 * 5,
    })
}

/**
 * Hook to check wether the current user is an admin.
 */
export function useIsAdmin(): { isAdmin: boolean; isLoading: boolean } {
    const { data: user, isLoading } = useMe()

    return {
        isAdmin: user?.role === 'admin',
        isLoading,
    }
}

/**
 * Primary authentication hook providing login, register, logout, and current user state.
 */
export function useAuth() {
    const queryClient = useQueryClient()
    const meQuery = useMe()

    const loginMutation = useMutation({
        mutationFn: async (payload: LoginPayload) => {
            const { data, error } = await api.POST('/auth/login', { body: payload })

            if (error) {
                throw new Error('Virheellinen sähköposti tai salasana.')
            }

            return data
        },
        onSuccess: (tokens) => {
            if (tokens?.access_token) {
                localStorage.setItem('access_token', tokens.access_token)
                localStorage.setItem('refresh_token', tokens.refresh_token)
            }

            queryClient.invalidateQueries({ queryKey: authKeys.me() })
        },
    })

    const registerMutation = useMutation({
        mutationFn: async (payload: RegisterPayload) => {
            const { data, error } = await api.POST('/auth/register', { body: payload })

            if (error) {
                throw new Error('Käyttäjätilin luonti epäonnistui.')
            }

            return data
        },
        onSuccess: (tokens) => {
            if (tokens?.access_token) {
                localStorage.setItem('access_token', tokens.access_token)
                localStorage.setItem('refresh_token', tokens.refresh_token)
            }

            queryClient.invalidateQueries({ queryKey: authKeys.me() })
        },
    })

    const logoutMutation = useMutation({
        mutationFn: async () => {
            const refreshToken = localStorage.getItem('refresh_token') || ''

            if (refreshToken) {
                const payload: RefreshPayload = { refresh_token: refreshToken }
                await api.POST('/auth/logout', { body: payload })
            }
        },
        onSettled: () => {
            localStorage.removeItem('access_token')
            localStorage.removeItem('refresh_token')

            queryClient.setQueryData(authKeys.me(), null)
            queryClient.clear()
        },
    })

    return {
        user: meQuery.data ?? null,
        isLoading: meQuery.isLoading,
        isAuthenticated: Boolean(meQuery.data),

        login: loginMutation.mutateAsync,
        register: registerMutation.mutateAsync,
        logout: logoutMutation.mutateAsync,

        isLoggingIn: loginMutation.isPending,
        isRegistering: registerMutation.isPending,
        isLoggingOut: logoutMutation.isPending,
        loginError: loginMutation.error?.message,
        registerError: registerMutation.error?.message,
    }

}
