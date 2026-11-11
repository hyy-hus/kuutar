import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export interface FilterBarProps {
	/** Controls in order: period nav, period length, filters. Use h-8 controls (`size="sm"`). */
	children: ReactNode;
	/** Right-aligned actions */
	actions?: ReactNode;
	className?: string;
}

/** L3 toolbar: tinted background, no border, hosts period navigation, selects and filters */
export function FilterBar({ children, actions, className }: FilterBarProps) {
	return (
		<div
			className={cn(
				"flex flex-wrap items-center gap-2 rounded-md bg-stone-100 p-2 dark:bg-stone-900",
				className,
			)}
		>
			{children}
			{actions && (
				<div className="ml-auto flex items-center gap-2">{actions}</div>
			)}
		</div>
	);
}
