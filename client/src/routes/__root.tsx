import {
    HeadContent,
    Outlet,
    Scripts,
    createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { getLocale } from '#/paraglide/runtime'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'
import type { components } from '#/api/schema'
import { authKeys, fetchMe } from '#/hooks/useAuth'

type User = components['schemas']['User']

export interface AuthContextType {
    user: User | null
    isAuthenticated: boolean
    isLoading: boolean
    isAdmin: boolean
}

export interface MyRouterContext {
    queryClient: QueryClient
    auth?: AuthContextType
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    beforeLoad: async ({ context }) => {
        const isClient = typeof window !== 'undefined'

        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('lang', getLocale())
        }

        let user: User | null = context.queryClient.getQueryData(authKeys.me()) ?? null

        if (!user && isClient) {
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

        return {
            auth: {
                user,
                isAuthenticated: Boolean(user),
                isLoading: false,
                isAdmin: user?.role === 'admin',
            },
        }
    },

    head: () => ({
        meta: [
            { charSet: 'utf-8' },
            { name: 'viewport', content: 'width=device-width, initial-scale=1' },
            { title: 'Kuutar varauskalenteri' },
        ],
        links: [
            { rel: 'stylesheet', href: appCss },
        ],
    }),
    shellComponent: RootDocument,
    component: RootComponent,
    notFoundComponent: () => (
        <div className="flex h-screen flex-col items-center justify-center p-4">
            <h1 className="text-xl font-bold">404 - Sivua ei löytynyt</h1>
            <a href="/" className="mt-4 text-blue-600 hover:underline">Palaa etusivulle</a>
        </div>
    )
})

function RootComponent() {
    return <Outlet />
}

function RootDocument({ children }: { children: React.ReactNode }) {
    const currentLocale = getLocale()

    return (
        <html lang={currentLocale}>
            <head>
                <HeadContent />
            </head>
            <body className="bg-stone-100 text-stone-800 dark:bg-stone-950 dark:text-stone-300 min-h-screen">
                {children}

                <TanStackDevtools
                    config={{ position: 'bottom-right' }}
                    plugins={[
                        {
                            name: 'Tanstack Router',
                            render: <TanStackRouterDevtoolsPanel />,
                        },
                        TanStackQueryDevtools,
                    ]}
                />
                <Scripts />
            </body>
        </html>
    )
}
