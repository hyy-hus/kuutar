import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

const BOX =
	"border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900";

/** KPI tile: mono eyebrow label + mono number */
export function StatCard({
	label,
	value,
	hint,
}: {
	label: string;
	value: ReactNode;
	hint?: string;
}) {
	return (
		<div className={cn(BOX, "p-4 space-y-1 min-w-0")}>
			<p className="text-xs font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400">
				{label}
			</p>
			<p className="text-2xl font-bold font-mono tabular-nums text-stone-900 dark:text-stone-100">
				{value}
			</p>
			{hint && (
				<p className="text-xs text-stone-600 dark:text-stone-400">{hint}</p>
			)}
		</div>
	);
}

/** Chart / list card (L2) with a titled h3 */
export function Panel({
	title,
	children,
	className,
}: {
	title: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section className={cn(BOX, "p-4 space-y-3 min-w-0", className)}>
			<h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
				{title}
			</h3>
			{children}
		</section>
	);
}

export function SectionHeading({ children }: { children: ReactNode }) {
	return (
		<h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
			{children}
		</h2>
	);
}

export function EmptyNote({ children }: { children: ReactNode }) {
	return (
		<p className="text-sm text-stone-600 dark:text-stone-400">{children}</p>
	);
}
