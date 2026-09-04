import { createFileRoute, Outlet, redirect, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useAuth } from '#/hooks/useAuth'

export const Route = createFileRoute('/_app/admin')({
    beforeLoad: async ({ context }) => {
        // Skip check during SSR pass so client localStorage token can be evaluated during hydration
        if (typeof window === 'undefined') return

        if (!context.auth?.isAuthenticated || !context.auth?.isAdmin) {
            throw redirect({
                to: '/',
                replace: true,
            })
        }
    },
    component: AdminLayout,
})

function AdminLayout() {
    const { user, isLoading } = useAuth()
    const navigate = useNavigate()

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'admin')) {
            navigate({ to: '/', replace: true })
        }
    }, [user, isLoading, navigate])

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
                <span className="text-sm font-medium text-stone-500">Tarkistetaan oikeuksia...</span>
            </div>
        )
    }

    if (!user || user.role !== 'admin') {
        return null
    }

    return <Outlet />
}
