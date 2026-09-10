// src/routes/_app.tsx
import { createFileRoute, Link, Outlet, useLocation } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { SearchBar } from '#/components/SearchBar'
import { Button } from '#/components/Button'
import { AuthDialog } from '#/components/AuthPopover'
import { SideBar } from '#/components/SideBar'
import { getLocale, setLocale, locales } from '#/paraglide/runtime'
import { cn } from '#/utils/cn'
import { authKeys, fetchMe } from '#/hooks/useAuth'

export const Route = createFileRoute('/_app')({
    beforeLoad: async ({ context }) => {
        try {
            const user = await context.queryClient.ensureQueryData({
                queryKey: authKeys.me(),
                queryFn: fetchMe,
                staleTime: 1000 * 60 * 5,
            })
            return { user }
        } catch {
            return { user: null }
        }
    },
    component: AppLayout,
})

function AppLayout() {
    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const location = useLocation()

    // Auto-close mobile drawer when route changes
    useEffect(() => {
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false)
        }
    }, [location.pathname])

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

    return (
        <div className="h-screen w-screen overflow-hidden flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
            {/* Header */}
            <header className="h-16 flex gap-2 items-center px-3 border-b-2 border-stone-800 dark:border-stone-600 bg-stone-100 dark:bg-stone-900 shrink-0 z-40">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    aria-label="Toggle Menu"
                >
                    <Menu size={20} />
                </Button>

                {/* Clickable Header Logo */}
                <Link to="/" className="hover:opacity-80 transition-opacity shrink-0">
                    <h1 className="font-bold text-base md:text-lg tracking-tight truncate">
                        Varauskalenteri
                    </h1>
                </Link>

                <div className="flex-1" />

                <div className="hidden sm:block">
                    <SearchBar />
                </div>

                <AuthDialog />
            </header>

            {/* Mobile Backdrop Overlay */}
            {isSidebarOpen && (
                <div
                    className="md:hidden fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-40 transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Layout Wrapper */}
            <div className="flex-1 relative flex overflow-hidden">
                {/* Mobile Drawer & Desktop Sidebar Container */}
                <aside
                    className={cn(
                        'bg-stone-100 dark:bg-stone-900 border-r-2 border-stone-800 dark:border-stone-600 transition-transform duration-300 ease-in-out shrink-0 flex flex-col shadow-2xl md:shadow-none',
                        // Mobile fixed drawer styling
                        'fixed md:static inset-y-0 left-0 z-50 h-full w-72 md:w-60',
                        isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
                    )}
                >
                    {/* Drawer Header on Mobile */}
                    <div className="flex items-center justify-between p-3 border-b-2 border-stone-800 dark:border-stone-700 md:hidden">
                        <span className="font-bold text-sm tracking-wide uppercase font-mono">Valikko</span>
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsSidebarOpen(false)}
                            aria-label="Close Drawer"
                        >
                            <X size={18} />
                        </Button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2">
                        <SideBar
                            isSidebarOpen={true}
                            currentLocale={currentLocale}
                            onSelectLocale={(next) => setLocale(next as any)}
                            availableLocales={locales as unknown as string[]}
                            theme={theme}
                            toggleTheme={toggleTheme}
                        />
                    </div>
                </aside>

                {/* Main Content Area */}
                <main className="flex-1 p-2 md:p-4 overflow-y-auto min-h-0 min-w-0">
                    <Outlet />
                </main>
            </div>

            {/* Footer */}
            <footer className="h-8 border-t-2 border-stone-800 dark:border-stone-600 flex items-center justify-between px-3 text-[11px] font-mono bg-stone-100 dark:bg-stone-900 shrink-0 z-40 text-stone-600 dark:text-stone-400">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-stone-800 dark:text-stone-200">kuutar</span>
                    <span className="hidden sm:inline text-stone-400">|</span>
                    <span className="hidden sm:inline">Helsingin yliopiston ylioppilaskunta</span>
                </div>
            </footer>
        </div>
    )
}
