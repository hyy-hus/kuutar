import { Link, type LinkComponentProps } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export type EntityCardProps = Omit<
	LinkComponentProps<"a">,
	"title" | "children"
> & {
	title: string;
	/** Leading icon next to the title */
	icon?: LucideIcon;
	/** One meta line, e.g. "Kokoelma · 12 henkilöä" */
	meta?: ReactNode;
	/** Clamped to two lines. Omit when empty; never print a placeholder. */
	description?: string;
	/** At most 3 badges, only non-default states (`StatusChip`/`Chip`) */
	badges?: ReactNode;
};

/**
 * Card for browsing a collection. The whole card is the link (pass `to`, `params`,
 * `search` like `Link`). Never put edit/delete buttons or ids on it.
 */
export function EntityCard({
	title,
	icon: Icon,
	meta,
	description,
	badges,
	className,
	...linkProps
}: EntityCardProps) {
	return (
		<Link
			{...linkProps}
			className={cn(
				"focus-ring hover-card flex flex-col gap-2 rounded-md border border-line-subtle bg-surface-raised p-4",
				className,
			)}
		>
			<div className="flex items-center gap-2">
				{Icon && (
					<Icon
						size={18}
						aria-hidden="true"
						className="shrink-0 text-stone-600 dark:text-stone-400"
					/>
				)}
				<h3 className="truncate text-base font-bold text-stone-900 dark:text-stone-100">
					{title}
				</h3>
			</div>
			{meta && (
				<p className="text-xs text-stone-600 dark:text-stone-400">{meta}</p>
			)}
			{description && (
				<p className="line-clamp-2 text-sm text-stone-700 dark:text-stone-300">
					{description}
				</p>
			)}
			{badges && <div className="flex flex-wrap gap-1.5 pt-1">{badges}</div>}
		</Link>
	);
}
