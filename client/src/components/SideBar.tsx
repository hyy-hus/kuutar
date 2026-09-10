// src/components/SideBar.tsx
import { Link } from '@tanstack/react-router'
import { Home, Calendar, Shield, Bookmark, Box, Folder, Users, User, Globe, Sun, Moon } from 'lucide-react'
import { Button } from '#/components/Button'
import { useAuth, useIsAdmin } from '#/hooks/useAuth'

interface SideBarProps {
    isSidebarOpen: boolean
    currentLocale: string
    toggleLanguage: () => void
    theme: 'light' | 'dark'
    toggleTheme: () => void
}

export function SideBar({
    currentLocale,
    toggleLanguage,
    theme,
    toggleTheme,
}: SideBarProps) {
    const { user } = useAuth()
    const { isAdmin } = useIsAdmin()

    const navItems = [
        { to: '/', label: 'Etusivu', icon: Home, public: true },
        { to: '/calendar', label: 'Kalenteri', icon: Calendar, public: true },
        { to: '/admin/dashboard', label: 'Ylläpito', icon: Shield, adminOnly: true },
        { to: '/reservations', label: 'Varaukset', icon: Bookmark, authOnly: true },
        { to: '/resources', label: 'Resurssit', icon: Box, adminOnly: true },
        { to: '/collections', label: 'Kokoelmat', icon: Folder, adminOnly: true },
        { to: '/groups', label: 'Ryhmät', icon: Users, adminOnly: true },
        { to: '/users', label: 'Käyttäjät', icon: User, adminOnly: true },
    ]

    const visibleNavItems = navItems.filter((item) => {
        if (item.public) return true
        if (item.adminOnly) return isAdmin
        if (item.authOnly) return Boolean(user)
        return false
    })

    return (
        <div className="flex flex-col justify-between h-full space-y-4">
            {/* Navigation Links */}
            <nav className="space-y-1">
                {visibleNavItems.map((item) => {
                    const Icon = item.icon
                    return (
                        <Link
                            key={item.to}
                            to={item.to}
                            activeProps={{
                                className: 'bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 font-bold',
                            }}
                            inactiveProps={{
                                className: 'text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800',
                            }}
                            className="flex items-center gap-3 px-3 py-2 text-xs font-mono rounded-md transition-colors"
                        >
                            <Icon size={16} className="shrink-0" />
                            <span className="truncate">{item.label}</span>
                        </Link>
                    )
                })}
            </nav>

            {/* Drawer Bottom Controls */}
            <div className="pt-3 border-t border-stone-300 dark:border-stone-800 flex gap-2 shrink-0">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleLanguage}
                    className="flex-1 flex items-center justify-center gap-1.5 text-xs font-mono"
                >
                    <Globe size={14} />
                    <span>{currentLocale === 'fi' ? 'Suomi' : 'English'}</span>
                </Button>

                <Button
                    variant="outline"
                    size="icon"
                    onClick={toggleTheme}
                    aria-label="Toggle Theme"
                >
                    {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                </Button>
            </div>
        </div>
    )
}
