import type { ReactNode } from "react";
import { FormActions, type FormActionsProps } from "#/components/FormActions";
import { cn } from "#/utils/cn";

export interface StickyFormActionsProps extends FormActionsProps {
	/** One line of what is being saved, e.g. "Sauna 1 · 12.11.2026 klo 10.00–12.00" */
	summary?: ReactNode;
}

/** `FormActions` pinned to the bottom of the viewport, with an optional summary line above the buttons */
export function StickyFormActions({
	summary,
	className,
	...actions
}: StickyFormActionsProps) {
	return (
		<div
			className={cn(
				"sticky bottom-0 z-10 space-y-2 border-t border-line-strong bg-surface py-3",
				className,
			)}
		>
			{summary && (
				<p
					className="truncate text-sm text-ink-muted"
					title={typeof summary === "string" ? summary : undefined}
				>
					{summary}
				</p>
			)}
			<FormActions {...actions} className="border-t-0 pt-0" />
		</div>
	);
}
