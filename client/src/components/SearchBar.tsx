// src/components/SearchBar.tsx
import { Search, X, Calendar, Box, Loader2 } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState, useRef, useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import { cn } from '#/utils/cn'
import { useSearch } from '#/hooks/useSearch'

export interface SearchBarProps {
    onSearch?: (query: string) => void
}

export function SearchBar({ onSearch }: SearchBarProps) {
    const [query, setQuery] = useState('')
    const [isOpen, setIsOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const previousElementRef = useRef<HTMLElement | null>(null)
    const navigate = useNavigate()

    const { resources, reservations, isLoading } = useSearch(query)

    const handleEscape = () => {
        setQuery('')
        onSearch?.('')
        setIsOpen(false)
        if (previousElementRef.current) {
            previousElementRef.current.focus()
            previousElementRef.current = null
        } else {
            inputRef.current?.blur()
        }
    }

    // Global Ctrl+K / Cmd+K listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault()

                if (
                    document.activeElement instanceof HTMLElement &&
                    document.activeElement !== inputRef.current
                ) {
                    previousElementRef.current = document.activeElement
                }

                inputRef.current?.focus()
                setIsOpen(true)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [])

    const handleClear = () => {
        setQuery('')
        onSearch?.('')
        inputRef.current?.focus()
    }

    const handleSelectResource = (resourceId: string) => {
        setIsOpen(false)
        setQuery('')
        navigate({
            to: '/calendar',
            search: { resources: [resourceId] } as any,
        })
    }

    const handleSelectReservation = (reservationId: string) => {
        setIsOpen(false)
        setQuery('')
        navigate({
            to: '/reservations/$id',
            params: { id: reservationId },
        })
    }

    const hasResults = resources.length > 0 || reservations.length > 0

    return (
        <div className="inline-block w-72">
            <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
                <Popover.Anchor asChild>
                    <div className="relative flex items-center w-full">
                        <Input
                            ref={inputRef}
                            type="text"
                            value={query}
                            onChange={(e) => {
                                setQuery(e.target.value)
                                onSearch?.(e.target.value)
                                if (!isOpen) setIsOpen(true)
                            }}
                            onFocus={(e) => {
                                setIsOpen(true)
                                if (
                                    e.relatedTarget instanceof HTMLElement &&
                                    e.relatedTarget !== inputRef.current
                                ) {
                                    previousElementRef.current = e.relatedTarget
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
                                    e.preventDefault()
                                    handleEscape()
                                }
                            }}
                            placeholder="Etsi varauksia & tiloja... [Ctrl+K]"
                            className={cn(
                                'w-full transition-all duration-150 text-xs font-mono',
                                query ? 'pr-16' : 'pr-9',
                                isOpen &&
                                'rounded-b-none border-stone-400 dark:border-stone-400 border-b-transparent focus-visible:outline-none'
                            )}
                        />
                        <div className="absolute right-1 flex items-center gap-0.5">
                            {query && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    onClick={handleClear}
                                    className="text-stone-400 hover:text-stone-700 dark:text-stone-500 dark:hover:text-stone-200 h-7 w-7"
                                    aria-label="Clear input"
                                >
                                    <X size={14} />
                                </Button>
                            )}
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 h-7 w-7 pointer-events-none"
                                aria-label="Search icon"
                            >
                                <Search size={15} />
                            </Button>
                        </div>
                    </div>
                </Popover.Anchor>

                <Popover.Portal>
                    <Popover.Content
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onEscapeKeyDown={(e) => {
                            e.preventDefault()
                            handleEscape()
                        }}
                        sideOffset={-1}
                        align="start"
                        style={{ width: 'var(--radix-popper-anchor-width)' }}
                        className={cn(
                            'p-2 bg-stone-50 dark:bg-stone-900 z-50 focus:outline-none max-w-none box-border max-h-80 overflow-y-auto',
                            'border border-t-0 border-stone-400 dark:border-stone-400 rounded-b-md shadow-lg',
                            'origin-top data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
                        )}
                    >
                        {!query.trim() ? (
                            <div className="p-2 text-xs text-stone-400 dark:text-stone-500 font-mono">
                                Kirjoita hakeaksesi varauksia tai resursseja...
                            </div>
                        ) : isLoading ? (
                            <div className="p-3 flex items-center gap-2 text-xs font-mono text-stone-500">
                                <Loader2 size={14} className="animate-spin" />
                                <span>Haetaan tuloksia...</span>
                            </div>
                        ) : !hasResults ? (
                            <div className="p-2 text-xs text-stone-500 font-mono">
                                Ei tuloksia hakusanalla &quot;{query}&quot;
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Matched Reservations */}
                                {reservations.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-mono font-bold tracking-wider text-stone-400 dark:text-stone-500 uppercase px-1">
                                            Varaukset ({reservations.length})
                                        </div>
                                        {reservations.slice(0, 5).map((res) => (
                                            <button
                                                key={res.id}
                                                type="button"
                                                onClick={() => handleSelectReservation(res.id)}
                                                className="w-full text-left p-2 rounded hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors flex items-start gap-2.5 group"
                                            >
                                                <Calendar size={14} className="mt-0.5 text-purple-600 dark:text-purple-400 shrink-0" />
                                                <div className="min-w-0 flex-1">
                                                    <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                                                        {res.title}
                                                    </div>
                                                    {res.description && (
                                                        <div className="text-[11px] text-stone-500 dark:text-stone-400 truncate font-mono">
                                                            {res.description}
                                                        </div>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Matched Resources */}
                                {resources.length > 0 && (
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-mono font-bold tracking-wider text-stone-400 dark:text-stone-500 uppercase px-1">
                                            Resurssit ({resources.length})
                                        </div>
                                        {resources.slice(0, 5).map((res) => (
                                            <button
                                                key={res.id}
                                                type="button"
                                                onClick={() => handleSelectResource(res.id)}
                                                className="w-full text-left p-2 rounded hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors flex items-center gap-2.5"
                                            >
                                                <Box size={14} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                                                <span className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                                                    {res.name}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    )
}
