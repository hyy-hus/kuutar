import { Search, X } from "lucide-react"
import { Popover } from "radix-ui"
import { useState, useRef, useEffect } from "react"
import { Input } from "#/components/Input"
import { Button } from "#/components/Button"
import { cn } from "#/utils/cn"

export interface SearchBarProps {
    onSearch?: (query: string) => void
}

export function SearchBar({ onSearch }: SearchBarProps) {
    const [query, setQuery] = useState("")
    const [isOpen, setIsOpen] = useState(false)
    const inputRef = useRef<HTMLInputElement>(null)
    const previousElementRef = useRef<HTMLElement | null>(null)

    const handleEscape = () => {
        setQuery("")
        onSearch?.("")
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
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault()

                // Capture where focus was before triggering Ctrl+K
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

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    const handleSearch = () => {
        onSearch?.(query)
    }

    const handleClear = () => {
        setQuery("")
        onSearch?.("")
        inputRef.current?.focus()
    }

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
                                if (!isOpen) setIsOpen(true)
                            }}
                            onFocus={(e) => {
                                setIsOpen(true)
                                // Track focus origin if coming from outside this component
                                if (
                                    e.relatedTarget instanceof HTMLElement &&
                                    e.relatedTarget !== inputRef.current
                                ) {
                                    previousElementRef.current = e.relatedTarget
                                }
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    handleSearch()
                                } else if (e.key === "Escape") {
                                    e.preventDefault()
                                    handleEscape()
                                }
                            }}
                            placeholder="Search... [Ctrl+K]"
                            className={cn(
                                "w-full transition-all duration-150",
                                query ? "pr-16" : "pr-9",
                                isOpen &&
                                "rounded-b-none border-stone-400 dark:border-stone-400 border-b-transparent focus-visible:outline-none"
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
                                onClick={handleSearch}
                                className="text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100 h-7 w-7"
                                aria-label="Submit search"
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
                        style={{ width: "var(--radix-popper-anchor-width)" }}
                        className={cn(
                            "p-3 bg-stone-50 dark:bg-stone-900 z-50 focus:outline-none max-w-none box-border",
                            "border border-t-0 border-stone-400 dark:border-stone-400 rounded-b-md shadow-lg",
                            "origin-top data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
                        )}
                    >
                        <div className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 mb-2 uppercase">
                            Search Results
                        </div>
                        {query ? (
                            <div className="text-sm text-stone-800 dark:text-stone-200">
                                Results for <span className="font-medium text-stone-950 dark:text-stone-50">&quot;{query}&quot;</span>
                            </div>
                        ) : (
                            <div className="text-sm text-stone-400 dark:text-stone-500">
                                Type to search...
                            </div>
                        )}
                    </Popover.Content>
                </Popover.Portal>
            </Popover.Root>
        </div>
    )
}
