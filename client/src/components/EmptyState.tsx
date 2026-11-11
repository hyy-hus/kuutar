import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export interface EmptyStateProps {
	title: ReactNode;
	/** Optional explanation under the title */
	children?: ReactNode;
	icon?: LucideIcon;
	/** Optional call-to-action, usually a `Button` */
	action?: ReactNode;
	className?: string;
}

/** Dashed, muted placeholder for a list or section with nothing in it */
export function EmptyState({
	title,
	children,
	icon: Icon,
	action,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center gap-2 rounded-md border border-dashed border-stone-400 px-4 py-8 text-center dark:border-stone-600",
				className,
			)}
		>
			{Icon && (
				<Icon
					size={24}
					aria-hidden="true"
					className="text-stone-500 dark:text-stone-400"
				/>
			)}
			<p className="text-sm font-medium text-stone-800 dark:text-stone-200">
				{title}
			</p>
			{children && (
				<p className="max-w-prose text-sm text-stone-600 dark:text-stone-400">
					{children}
				</p>
			)}
			{action && <div className="pt-1">{action}</div>}
		</div>
	);
}
