// src/components/BackLink.tsx
import { Link, type LinkComponentProps } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { cn } from "#/utils/cn";

/** "Back to X" navigation link shown at the top of sub pages */
export function BackLink({
	children,
	className,
	...props
}: LinkComponentProps<"a">) {
	return (
		<Link
			{...props}
			className={cn(
				"inline-flex items-center gap-1 text-xs text-stone-500 hover:underline",
				className,
			)}
		>
			<ArrowLeft size={14} />
			<span>{children as React.ReactNode}</span>
		</Link>
	);
}
