import { cn } from "#/utils/cn";
import type { ReactNode } from "react";

export function Chip({ children }: { children: ReactNode }) {
    return (
        <span className={cn('px-2 py-1 bg-stone-300 text-stone-700 dark:bg-stone-800 dark:text-stone-300 rounded-sm font-mono text-xs inline-flex items-center justify-center')}>
            {children}
        </span>
    )
}
