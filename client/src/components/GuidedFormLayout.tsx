import type { ReactNode } from "react";
import { FormIndex, type FormIndexItem } from "#/components/FormIndex";

export interface GuidedFormLayoutProps {
	/** Sections of the form, in order; each `id` must match a `FormSection id` */
	index: FormIndexItem[];
	/** Accessible name of the section index */
	indexLabel: string;
	/** Optional `FormSummaryCard` under the index (wide screens only) */
	summary?: ReactNode;
	/** The `FormSection`s and `StickyFormActions` */
	children: ReactNode;
}

/**
 * Form body with a sticky side column (section index + live summary) from `lg` up. Below that the
 * sections stack on their own; `StickyFormActions` carries the short summary instead.
 */
export function GuidedFormLayout({
	index,
	indexLabel,
	summary,
	children,
}: GuidedFormLayoutProps) {
	return (
		<div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_15rem]">
			<div className="min-w-0 space-y-6">{children}</div>
			<aside className="sticky top-0 hidden space-y-4 lg:block">
				<FormIndex items={index} aria-label={indexLabel} />
				{summary}
			</aside>
		</div>
	);
}
