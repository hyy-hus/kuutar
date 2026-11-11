import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface FormSectionProps {
	title: string;
	description?: string;
	/** Anchor for `FormIndex`; also makes in-page jumps land below the sticky chrome */
	id?: string;
	/** Position in a guided form (1, 2, ...), shown as a number before the title */
	step?: number;
	/** @deprecated Sections have no icons; accepted and ignored so old callers compile */
	icon?: LucideIcon;
	children: ReactNode;
}

/** Titled group of related form fields */
export function FormSection({
	title,
	description,
	id,
	step,
	children,
}: FormSectionProps) {
	const headingId = id ? `${id}-title` : undefined;
	return (
		<section
			id={id}
			aria-labelledby={headingId}
			className="scroll-mt-6 space-y-4 border-t border-line-subtle pt-4"
		>
			<div className="flex items-start gap-3">
				{step !== undefined && (
					<span
						aria-hidden="true"
						className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-line-strong text-sm font-semibold tabular-nums text-ink"
					>
						{step}
					</span>
				)}
				<div className="min-w-0 space-y-0.5">
					<h2 id={headingId} className="text-lg font-semibold text-ink">
						{title}
					</h2>
					{description && (
						<p className="text-sm text-ink-muted">{description}</p>
					)}
				</div>
			</div>
			{children}
		</section>
	);
}
