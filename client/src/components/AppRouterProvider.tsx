import { RouterProvider } from '@tanstack/react-router'
import { getRouter } from '#/router'
import { useAuth } from '#/hooks/useAuth'
import { getContext } from '#/integrations/tanstack-query/root-provider'

const router = getRouter()

export function AppRouterProvider() {
    const auth = useAuth()
    const { queryClient } = getContext()

    // Show a global loading spinner while initial auth status resolves
    if (auth.isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
                <span className="text-sm font-medium text-stone-500">Ladataan...</span>
            </div>
        )
    }

    return (
        <RouterProvider
            router={router}
            context={{
                queryClient,
                auth: {
                    user: auth.user,
                    isAuthenticated: auth.isAuthenticated,
                    isLoading: auth.isLoading,
                    isAdmin: auth.user?.role === 'admin',
                },
            }}
        />
    )
}
