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

import { Globe, Menu, Moon, Sun, User } from 'lucide-react';
import { SearchBar } from '#/components/SearchBar'
import { useEffect, useState } from 'react'
import { cn } from '#/utils/cn'

interface MyRouterContext {
    queryClient: QueryClient
}

export const Route = createRootRouteWithContext<MyRouterContext>()({
    beforeLoad: async () => {
        // Other redirect strategies are possible; see
        // https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#offline-redirect
        if (typeof document !== 'undefined') {
            document.documentElement.setAttribute('lang', getLocale())
        }
    },

    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                title: 'Kuutar varauskalenteri',
            },
        ],
        links: [
            {
                rel: 'stylesheet',
                href: appCss,
            },
        ],
    }),
    shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [theme, setTheme] = useState<'light' | 'dark'>(() => {
        if (typeof window !== 'undefined') {
            return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
        }
        return 'light';
    });

    useEffect(() => {
        const root = document.documentElement;
        if (theme === 'dark') {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const currentLocale = getLocale();
    const toggleLanguage = () => {
        const nextLocale = currentLocale === 'fi' ? 'en' : 'fi';
        setLocale(nextLocale);
    };

    return (
        <html lang={currentLocale}>
            <head>
                <HeadContent />
            </head>
            <body
                className={cn(
                    "h-screen bg-stone-100 text-stone-800 dark:bg-stone-950 dark:text-stone-300",
                    "grid grid-rows-[4rem_1fr_2rem]",
                    // Animate grid track changes smoothly
                    "transition-[grid-template-columns,colors] duration-300 ease-in-out",
                    isSidebarOpen ? "grid-cols-[15rem_1fr]" : "grid-cols-[0rem_1fr]"
                )}
            >
                <header className={cn("col-span-2 flex gap-2 items-center p-2 border-b-2 border-stone-800 dark:border-stone-600")}>
                    <button
                        type="button"
                        onClick={() => setIsSidebarOpen((prev) => !prev)}
                        className={cn("p-1 rounded-md hover:bg-stone-200 dark:hover:bg-stone-900 transition-colors cursor-pointer")}
                        aria-label="Toggle Menu"
                    >
                        <Menu />
                    </button>
                    <h1 className={cn("font-bold text-lg")}>Varauskalenteri</h1>
                    <div className={cn("flex-1")} />
                    <SearchBar />
                    <User />
                </header>

                {/* Sidebar always stays in DOM; overflow-hidden clips inner content during slide */}
                <aside
                    className={cn(
                        "overflow-hidden transition-all duration-300 ease-in-out",
                        "border-stone-800 dark:border-stone-600",
                        isSidebarOpen ? "border-r-2 opacity-100" : "border-r-0 opacity-0"
                    )}
                >
                    {/* Fixed inner width prevents content text from squishing while sliding */}
                    <div className={cn("w-[15rem] h-full whitespace-nowrap")}>
                        <ul className={cn("gap-2 h-full flex flex-col divide-y-2 divide-stone-800 dark:divide-stone-600 *:p-2")}>
                            <li>Varaukset</li>
                            <li>Resurssit</li>
                            <li>Tilastoja</li>
                            <li className={cn("flex-1")} />
                            <li className={cn("flex items-center justify-between gap-2")}>
                                <button
                                    type="button"
                                    onClick={toggleLanguage}
                                    className={cn("flex items-center gap-1.5 text-xs font-semibold hover:underline cursor-pointer")}
                                >
                                    <Globe size={16} />
                                    <span>{currentLocale === 'fi' ? 'Suomi' : 'English'}</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={toggleTheme}
                                    className={cn("p-1 rounded hover:bg-stone-200 dark:hover:bg-stone-900 transition-colors cursor-pointer")}
                                    aria-label="Toggle Theme"
                                >
                                    {theme === 'light' ? <Sun size={16} /> : <Moon size={16} />}
                                </button>
                            </li>
                        </ul>
                    </div>
                </aside>

                <main className={cn("p-4 overflow-y-auto")}>
                    {children}
                </main>

                <footer className={cn("col-span-2 border-t-2 border-stone-800 dark:border-stone-600 flex gap-2 items-center p-2 text-xs")}>
                    kuutar 0.1.0
                </footer>

                <TanStackDevtools
                    config={{
                        position: 'bottom-right',
                    }}
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
    );
}
