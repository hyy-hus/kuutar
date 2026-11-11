import type { ReactNode } from "react";
import { PageContainer } from "#/components/PageContainer";

export interface FormLayoutProps {
	/**
	 * `narrow` (default) for single-column forms, `default` for forms with side-by-side fields,
	 * `guided` for long forms with a side column (`GuidedFormLayout`)
	 */
	width?: "narrow" | "default" | "guided";
	children: ReactNode;
}

/** Left-aligned column for create/edit pages: `PageHeader`, then `FormSection`s, then `FormActions` */
export function FormLayout({ width = "narrow", children }: FormLayoutProps) {
	if (width === "guided") {
		return <PageContainer className="max-w-5xl">{children}</PageContainer>;
	}
	return <PageContainer width={width}>{children}</PageContainer>;
}
