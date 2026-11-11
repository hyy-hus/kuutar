import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export interface FormSummaryItem {
	label: string;
	value: ReactNode;
}

export interface FormSummaryCardProps {
	title: string;
	items: FormSummaryItem[];
	/** Extra line under the list, e.g. what happens after saving */
	footer?: ReactNode;
	className?: string;
}

/** Live "Yhteenveto" of what the form is about to save; sits in the side column on wide screens */
export function FormSummaryCard({
	title,
	items,
	footer,
	className,
}: FormSummaryCardProps) {
	return (
		<section
			className={cn(
				"space-y-3 rounded-md border border-line-subtle bg-surface-raised p-4",
				className,
			)}
		>
			<h2 className="text-base font-bold text-ink">{title}</h2>
			<dl className="space-y-2 text-sm">
				{items.map((item) => (
					<div key={item.label}>
						<dt className="text-xs text-ink-muted">{item.label}</dt>
						<dd className="break-words text-ink">{item.value}</dd>
					</div>
				))}
			</dl>
			{footer && (
				<p className="border-t border-line-subtle pt-3 text-xs text-ink-muted">
					{footer}
				</p>
			)}
		</section>
	);
}
