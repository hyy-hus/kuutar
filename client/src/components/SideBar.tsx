// src/components/SideBar.tsx
import { Link } from '@tanstack/react-router'
import {
    Home,
    Calendar,
    BarChart3,
    Shield,
    Bookmark,
    Box,
    Folder,
    Users,
    User,
    Globe,
    Sun,
    Moon,
    ChevronDown,
} from 'lucide-react'
import { useAuth, useIsAdmin } from '#/hooks/useAuth'

interface SideBarProps {
    isSidebarOpen: boolean
    currentLocale: string
    onSelectLocale: (locale: string) => void
    availableLocales?: string[]
    theme: 'light' | 'dark'
    toggleTheme: () => void
}

const LANGUAGE_LABELS: Record<string, string> = {
    fi: 'Suomi',
    en: 'English',
    sv: 'Svenska',
}

export function SideBar({
    currentLocale,
    onSelectLocale,
    availableLocales = ['fi', 'en', 'sv'],
    theme,
    toggleTheme,
}: SideBarProps) {
    const { user } = useAuth()
    const { isAdmin } = useIsAdmin()

    const navItems = [
        { to: '/', label: 'Etusivu', icon: Home, public: true },
        { to: '/calendar', label: 'Kalenteri', icon: Calendar, public: true },
        { to: '/stats', label: 'Tilastot', icon: BarChart3, public: true },
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

            {/* Bottom Controls Bar */}
            <div className="pt-3 border-t border-stone-300 dark:border-stone-800 flex gap-1.5 items-center shrink-0">
                {/* Language Select Dropdown */}
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-500 dark:text-stone-400">
                        <Globe size={14} />
                    </div>
                    <select
                        value={currentLocale}
                        onChange={(e) => onSelectLocale(e.target.value)}
                        className="w-full h-8 pl-8 pr-7 text-xs font-mono font-medium rounded-md border border-stone-300 dark:border-stone-700 bg-stone-200/60 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 appearance-none cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-600"
                    >
                        {availableLocales.map((code) => (
                            <option key={code} value={code} className="bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100">
                                {LANGUAGE_LABELS[code] || code.toUpperCase()}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-stone-400">
                        <ChevronDown size={13} />
                    </div>
                </div>

                {/* Theme Switcher Button */}
                <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label="Toggle Theme"
                    className="h-8 w-8 shrink-0 rounded-md border border-stone-300 dark:border-stone-700 bg-stone-200/60 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-purple-600"
                >
                    {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
            </div>
        </div>
    )
}
