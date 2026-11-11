import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export interface SegmentedOption<T extends string> {
	value: T;
	label: ReactNode;
	/** Shows a small dot, e.g. "this language has content" */
	dot?: boolean;
}

export interface SegmentedControlProps<T extends string> {
	options: SegmentedOption<T>[];
	value: T;
	onChange: (value: T) => void;
	/** Accessible name of the group */
	"aria-label": string;
	/** `group` = toggle buttons (default); `tablist` when the control switches a panel */
	role?: "group" | "tablist";
	className?: string;
}

/** Compact one-of-n switch (h-8); the selected segment is filled black */
export function SegmentedControl<T extends string>({
	options,
	value,
	onChange,
	"aria-label": ariaLabel,
	role = "group",
	className,
}: SegmentedControlProps<T>) {
	const isTabs = role === "tablist";
	return (
		<div
			{...{ role, "aria-label": ariaLabel }}
			className={cn(
				"inline-flex h-8 overflow-hidden rounded-md border border-stone-400 dark:border-stone-600",
				className,
			)}
		>
			{options.map((option) => {
				const selected = option.value === value;
				return (
					<button
						key={option.value}
						type="button"
						{...(isTabs
							? { role: "tab", "aria-selected": selected }
							: { "aria-pressed": selected })}
						onClick={() => onChange(option.value)}
						className={cn(
							"focus-ring inline-flex cursor-pointer items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap transition-colors focus-visible:-outline-offset-2",
							"not-first:border-l not-first:border-stone-400 dark:not-first:border-stone-600",
							selected
								? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
								: "bg-transparent text-stone-800 hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-800",
						)}
					>
						{option.label}
						{option.dot && (
							<span
								aria-hidden="true"
								className="size-1.5 rounded-full bg-emerald-500"
							/>
						)}
					</button>
				);
			})}
		</div>
	);
}
