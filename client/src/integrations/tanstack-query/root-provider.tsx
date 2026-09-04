import { QueryClient } from '@tanstack/react-query'
import type { components } from '#/api/schema'

type User = components['schemas']['User']

export interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    isAdmin: boolean
}

export interface MyRouterContext {
    queryClient: QueryClient
    auth: AuthContextType
}

export function getContext(): MyRouterContext {
    const queryClient = new QueryClient()

    return {
        queryClient,
        auth: {
            user: null,
            isAuthenticated: false,
            isLoading: true,
            isAdmin: false,
        },
    }
}

export default function TanstackQueryProvider() { }
