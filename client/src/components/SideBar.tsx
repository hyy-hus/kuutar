import { Link } from '@tanstack/react-router'
import {
    BookmarkCheck,
    Box,
    Calendar,
    Folder,
    Globe,
    Moon,
    Sun,
    UserCheck,
    Users,
} from 'lucide-react'
import { Button } from '#/components/Button'
import { cn } from '#/utils/cn'

interface SideBarProps {
    isSidebarOpen: boolean
    currentLocale: string
    toggleLanguage: () => void
    theme: 'light' | 'dark'
    toggleTheme: () => void
}

const navItems = [
    { to: '/calendar', label: 'Kalenteri', icon: Calendar },
    { to: '/reservations', label: 'Varaukset', icon: BookmarkCheck },
    { to: '/resources', label: 'Resurssit', icon: Box },
    { to: '/collections', label: 'Kokoelmat', icon: Folder },
    { to: '/groups', label: 'Ryhmät', icon: Users },
    { to: '/users', label: 'Käyttäjät', icon: UserCheck },
]

export function SideBar({
    isSidebarOpen,
    currentLocale,
    toggleLanguage,
    theme,
    toggleTheme,
}: SideBarProps) {
    return (
        <aside
            className={cn(
                'overflow-hidden transition-all duration-300 ease-in-out bg-stone-100 dark:bg-stone-900',
                'border-stone-800 dark:border-stone-600',
                isSidebarOpen ? 'border-r-2 opacity-100' : 'border-r-0 opacity-0'
            )}
        >
            <div className="w-60 h-full flex flex-col justify-between p-2 select-none whitespace-nowrap">
                {/* Navigation Links */}
                <nav className="flex flex-col gap-1">
                    {navItems.map((item) => (
                        <Link
                            key={item.to}
                            to={item.to}
                            className={cn(
                                'flex items-center gap-3 px-3 py-2 text-xs font-mono font-bold rounded-sm transition-all',
                                'border-2 border-transparent',
                                'hover:bg-stone-200 dark:hover:bg-stone-800 hover:border-stone-800 dark:hover:border-stone-600'
                            )}
                            activeProps={{
                                className:
                                    'bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 hover:bg-stone-900 dark:hover:bg-stone-100 shadow-xs',
                            }}
                        >
                            <item.icon size={16} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Bottom Utility Controls */}
                <div className="pt-2 border-t-2 border-stone-800 dark:border-stone-600 flex items-center justify-between gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={toggleLanguage}
                        className="flex-1 justify-start gap-2 text-xs font-mono border border-stone-800 dark:border-stone-600 rounded-sm"
                    >
                        <Globe size={14} />
                        <span>{currentLocale === 'fi' ? 'Suomi' : 'English'}</span>
                    </Button>

                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={toggleTheme}
                        aria-label="Toggle Theme"
                        className="border border-stone-800 dark:border-stone-600 rounded-sm shrink-0"
                    >
                        {theme === 'light' ? <Sun size={14} /> : <Moon size={14} />}
                    </Button>
                </div>
            </div>
        </aside>
    )
}
