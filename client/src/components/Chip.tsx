// src/components/Chip.tsx
import type { ReactNode, ComponentPropsWithoutRef } from "react";
import { cn } from "#/utils/cn";

export interface ChipProps {
    children: ReactNode;
    className?: string;
}

export function Chip({ children, className }: ChipProps) {
    return (
        <span
            className={cn(
                "px-2 py-1 bg-stone-300 text-stone-700 dark:bg-stone-800 dark:text-stone-300 rounded-sm font-mono text-xs inline-flex items-center justify-center",
                className
            )}
        >
            {children}
        </span>
    );
}

export interface ToggleChipProps extends ComponentPropsWithoutRef<"button"> {
    selected?: boolean;
    children: ReactNode;
}

export function ToggleChip({
    selected = false,
    children,
    className,
    type = "button",
    ...props
}: ToggleChipProps) {
    return (
        <button
            type={type}
            aria-pressed={selected}
            className={cn(
                "px-2 py-1 rounded-sm font-mono text-xs inline-flex items-center justify-center border transition-colors cursor-pointer select-none",
                selected
                    ? "bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100 font-semibold shadow-xs"
                    : "bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200 dark:bg-stone-900 dark:text-stone-400 dark:border-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-200",
                className
            )}
            {...props}
        >
            {children}
        </button>
    );
}
