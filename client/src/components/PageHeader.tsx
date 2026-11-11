import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export interface PageHeaderProps {
	/** The page h1: nav label on list pages, entity name on detail pages. No icon. */
	title: ReactNode;
	/** One muted line, e.g. a count ("16 resurssia") */
	subtitle?: ReactNode;
	/** Right of the title: at most one primary button, then secondary ones */
	actions?: ReactNode;
	/** A `BackLink`, rendered directly above the title */
	back?: ReactNode;
	/** Rendered next to the title, e.g. a `StatusChip` on detail pages */
	status?: ReactNode;
	className?: string;
}

/** Standard page header: back link, title row with actions, subtitle. No divider. */
export function PageHeader({
	title,
	subtitle,
	actions,
	back,
	status,
	className,
}: PageHeaderProps) {
	return (
		<header className={cn("space-y-2", className)}>
			{back}
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
					<h1 className="text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 wrap-break-word">
						{title}
					</h1>
					{status}
				</div>
				{actions && (
					<div className="flex flex-wrap items-center gap-2">{actions}</div>
				)}
			</div>
			{subtitle && (
				<p className="text-sm text-stone-600 dark:text-stone-400">{subtitle}</p>
			)}
		</header>
	);
}
