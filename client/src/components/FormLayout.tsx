import type { ReactNode } from "react";
import { PageContainer } from "#/components/PageContainer";

export interface FormLayoutProps {
	/** `narrow` (default) for single-column forms, `default` for forms with side-by-side fields */
	width?: "narrow" | "default";
	children: ReactNode;
}

/** Left-aligned column for create/edit pages: `PageHeader`, then `FormSection`s, then `FormActions` */
export function FormLayout({ width = "narrow", children }: FormLayoutProps) {
	return <PageContainer width={width}>{children}</PageContainer>;
}
