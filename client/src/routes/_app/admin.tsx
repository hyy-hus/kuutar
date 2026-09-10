// src/routes/_app/admin.tsx
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { authKeys, fetchMe } from '#/hooks/useAuth'

export const Route = createFileRoute('/_app/admin')({
    beforeLoad: async ({ context }) => {
        if (typeof window === 'undefined') return

        let user = context.user
        if (user === undefined) {
            try {
                user = await context.queryClient.ensureQueryData({
                    queryKey: authKeys.me(),
                    queryFn: fetchMe,
                    staleTime: 1000 * 60 * 5,
                })
            } catch {
                user = null
            }
        }

        if (!user || user.role !== 'admin') {
            throw redirect({
                to: '/',
                replace: true,
            })
        }
    },
    component: AdminLayout,
})

function AdminLayout() {
    return <Outlet />
}
