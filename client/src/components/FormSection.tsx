import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface FormSectionProps {
	title: string;
	description?: string;
	icon?: LucideIcon;
	children: ReactNode;
}

/** Titled group of related form fields */
export function FormSection({
	title,
	description,
	icon: Icon,
	children,
}: FormSectionProps) {
	return (
		<section className="space-y-3 pt-4 border-t border-stone-200 dark:border-stone-800">
			<div className="space-y-0.5">
				<h2 className="text-sm font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
					{Icon && (
						<Icon
							size={14}
							className="text-purple-600 dark:text-purple-400 shrink-0"
						/>
					)}
					<span>{title}</span>
				</h2>
				{description && (
					<p className="text-[11px] text-stone-500 dark:text-stone-400">
						{description}
					</p>
				)}
			</div>
			{children}
		</section>
	);
}
