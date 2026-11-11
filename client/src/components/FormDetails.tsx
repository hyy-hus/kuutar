import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export interface FormDetailsProps {
	/** Heading of the collapsed block, e.g. "Lisäasetukset" */
	title: string;
	/** What is inside, so people know whether they need to open it */
	description?: string;
	defaultOpen?: boolean;
	children: ReactNode;
	className?: string;
}

/** Collapsed block for rarely used fields inside a `FormSection` */
export function FormDetails({
	title,
	description,
	defaultOpen = false,
	children,
	className,
}: FormDetailsProps) {
	return (
		<details
			open={defaultOpen}
			className={cn(
				"group rounded-md border border-line-subtle bg-surface-raised",
				className,
			)}
		>
			<summary className="focus-ring flex cursor-pointer list-none items-start gap-2 rounded-md px-3 py-2.5 [&::-webkit-details-marker]:hidden">
				<ChevronRight
					size={16}
					aria-hidden="true"
					className="mt-0.5 shrink-0 text-ink-muted transition-transform group-open:rotate-90"
				/>
				<span className="min-w-0">
					<span className="block text-sm font-semibold text-ink">{title}</span>
					{description && (
						<span className="block text-xs text-ink-muted">{description}</span>
					)}
				</span>
			</summary>
			<div className="space-y-4 border-t border-line-subtle p-3">
				{children}
			</div>
		</details>
	);
}
