import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface FormSectionProps {
	title: string;
	description?: string;
	/** @deprecated Sections have no icons; accepted and ignored so old callers compile */
	icon?: LucideIcon;
	children: ReactNode;
}

/** Titled group of related form fields */
export function FormSection({
	title,
	description,
	children,
}: FormSectionProps) {
	return (
		<section className="space-y-3 border-t border-stone-300 pt-4 dark:border-stone-700">
			<div className="space-y-0.5">
				<h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
					{title}
				</h2>
				{description && (
					<p className="text-xs text-stone-600 dark:text-stone-400">
						{description}
					</p>
				)}
			</div>
			{children}
		</section>
	);
}
