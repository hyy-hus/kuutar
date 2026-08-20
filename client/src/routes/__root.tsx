import {
    HeadContent,
    Scripts,
    createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import TanStackQueryDevtools from '../integrations/tanstack-query/devtools'
import { getLocale, setLocale } from '#/paraglide/runtime'
import appCss from '../styles.css?url'
import type { QueryClient } from '@tanstack/react-query'

import { Menu } from 'lucide-react'
import { SearchBar } from '#/components/SearchBar'
import { useEffect, useState } from 'react'
import { cn } from '#/utils/cn'
import { Button } from '#/components/Button'
import { AuthDialog } from '#/components/AuthPopover'
import { SideBar } from '#/components/SideBar'

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
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
        }
        return 'light'
    })

    useEffect(() => {
        const root = document.documentElement
        if (theme === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
        localStorage.setItem('theme', theme)
    }, [theme])

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))
    }

    const currentLocale = getLocale()
    const toggleLanguage = () => {
        const nextLocale = currentLocale === 'fi' ? 'en' : 'fi'
        setLocale(nextLocale)
    }

    return (
        <html lang={currentLocale}>
            <head>
                <HeadContent />
            </head>
            <body
                className={cn(
                    'h-screen bg-stone-100 text-stone-800 dark:bg-stone-950 dark:text-stone-300',
                    'grid grid-rows-[4rem_1fr_2rem]',
                    'transition-[grid-template-columns,colors] duration-300 ease-in-out',
                    isSidebarOpen ? 'grid-cols-[15rem_1fr]' : 'grid-cols-[0rem_1fr]'
                )}
            >
                <header className={cn('col-span-2 flex gap-2 items-center p-2 border-b-2 border-stone-800 dark:border-stone-600 bg-stone-100 dark:bg-stone-900')}>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen((prev) => !prev)}
                        aria-label="Toggle Menu"
                    >
                        <Menu size="20" />
                    </Button>
                    <h1 className={cn('font-bold text-lg tracking-tight')}>Varauskalenteri</h1>
                    <div className={cn('flex-1')} />
                    <SearchBar />
                    <AuthDialog />
                </header>

                <SideBar
                    isSidebarOpen={isSidebarOpen}
                    currentLocale={currentLocale}
                    toggleLanguage={toggleLanguage}
                    theme={theme}
                    toggleTheme={toggleTheme}
                />

                <main className={cn('p-4 overflow-y-auto')}>
                    {children}
                </main>

                <footer className={cn('col-span-2 border-t-2 border-stone-800 dark:border-stone-600 flex gap-2 items-center p-2 text-xs font-mono bg-stone-100 dark:bg-stone-900')}>
                    kuutar 0.1.0
                </footer>

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
