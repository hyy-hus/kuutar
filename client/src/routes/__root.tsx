// src/routes/__root.tsx
import {
    HeadContent,
    Scripts,
    createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { getLocale } from '#/paraglide/runtime'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'

interface MyRouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    beforeLoad: async () => {
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('lang', getLocale())
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
})

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
