import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

const WIDTHS = {
	wide: "max-w-7xl",
	default: "max-w-3xl",
	narrow: "max-w-xl",
} as const;

export interface PageContainerProps {
	/** `wide` lists/tables/dashboards, `default` detail pages, `narrow` single-column forms */
	width?: keyof typeof WIDTHS;
	className?: string;
	children: ReactNode;
}

/** Left-aligned page content column with vertical rhythm. Outer padding comes from the shell. */
export function PageContainer({
	width = "wide",
	className,
	children,
}: PageContainerProps) {
	return (
		<div className={cn("w-full space-y-6", WIDTHS[width], className)}>
			{children}
		</div>
	);
}
