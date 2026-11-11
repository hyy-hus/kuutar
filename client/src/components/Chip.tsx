// src/components/Chip.tsx
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "#/utils/cn";

export interface ChipProps {
	children: ReactNode;
	className?: string;
	title?: string;
}

/** Neutral label for tags such as resource names. For states use `StatusChip`. */
export function Chip({ children, className, title }: ChipProps) {
	return (
		<span
			title={title}
			className={cn(
				"px-2 py-1 bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 rounded-sm text-xs font-medium inline-flex items-center justify-center",
				className,
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
			// With role="checkbox" the caller sets aria-checked instead
			aria-pressed={props.role === "checkbox" ? undefined : selected}
			className={cn(
				"focus-ring px-2.5 py-1 rounded-sm text-xs font-medium inline-flex items-center justify-center gap-1.5 border transition-colors cursor-pointer select-none",
				selected
					? "bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-100 dark:text-stone-900 dark:border-stone-100"
					: "bg-stone-100 text-stone-700 border-stone-300 hover:bg-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:border-stone-700 dark:hover:bg-stone-800",
				className,
			)}
			{...props}
		>
			{children}
		</button>
	);
}
