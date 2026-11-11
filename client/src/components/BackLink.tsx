// src/components/BackLink.tsx
import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "#/utils/cn";

/** "Back to <list name>" link; goes in `PageHeader`'s `back` slot, directly above the title */
export function BackLink({
	children,
	className,
	...props
}: LinkComponentProps<"a">) {
	return (
		<Link
			{...props}
			className={cn(
				"focus-ring inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900 hover:underline dark:text-stone-400 dark:hover:text-stone-100",
				className,
			)}
		>
			<ArrowLeft size={14} aria-hidden="true" />
			<span>{children as React.ReactNode}</span>
		</Link>
	);
}
