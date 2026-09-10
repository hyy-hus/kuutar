// src/utils/authGuard.ts
import { redirect } from '@tanstack/react-router'
import { authKeys, fetchMe } from '#/hooks/useAuth'
import type { QueryClient } from '@tanstack/react-query'

export async function requireAuthGuard(context: { queryClient: QueryClient; user?: any }) {
    let user = context.user

    if (!user) {
        try {
            user = await context.queryClient.fetchQuery({
                queryKey: authKeys.me(),
                queryFn: fetchMe,
                staleTime: 1000 * 60 * 5,
            })
        } catch {
            user = null
        }
    }

    if (!user) {
        throw redirect({
            to: '/',
            replace: true,
        })
    }

    return user
}
