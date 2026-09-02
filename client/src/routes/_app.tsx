// src/routes/_app.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Menu } from 'lucide-react'
import { SearchBar } from '#/components/SearchBar'
import { Button } from '#/components/Button'
import { AuthDialog } from '#/components/AuthPopover'
import { SideBar } from '#/components/SideBar'
import { getLocale, setLocale } from '#/paraglide/runtime'
import { cn } from '#/utils/cn'

export const Route = createFileRoute('/_app')({
    component: AppLayout,
})

function AppLayout() {
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
        <div
            className={cn(
                'h-screen w-screen overflow-hidden',
                'grid grid-rows-[4rem_1fr_2rem]',
                'transition-[grid-template-columns,colors] duration-300 ease-in-out',
                isSidebarOpen ? 'grid-cols-[15rem_1fr]' : 'grid-cols-[0rem_1fr]'
            )}
        >
            <header className="col-span-2 flex gap-2 items-center p-2 border-b-2 border-stone-800 dark:border-stone-600 bg-stone-100 dark:bg-stone-900">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsSidebarOpen((prev) => !prev)}
                    aria-label="Toggle Menu"
                >
                    <Menu size="20" />
                </Button>
                <h1 className="font-bold text-lg tracking-tight">Varauskalenteri</h1>
                <div className="flex-1" />
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

            <main className="p-4 overflow-y-auto">
                <Outlet />
            </main>

            <footer className="col-span-2 border-t-2 border-stone-800 dark:border-stone-600 flex gap-2 items-center p-2 text-xs font-mono bg-stone-100 dark:bg-stone-900">
                kuutar 0.1.0
            </footer>
        </div>
    )
}
