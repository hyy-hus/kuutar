import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "#/utils/cn";
import {
	getLocalizedDoc,
	richTextClassName,
	richTextToHtml,
} from "#/utils/richText";

interface RichTextContentProps {
	/** Localized description as returned by the API */
	value: unknown;
	className?: string;
	fallback?: React.ReactNode;
}

/** Renders a localized rich-text description in the current language */
export function RichTextContent({
	value,
	className,
	fallback = null,
}: RichTextContentProps) {
	const { i18n } = useTranslation();

	// generateHTML only emits nodes and marks from the editor schema, and the
	// Link extension drops unsafe href protocols, so the output is safe to inject
	const html = useMemo(() => {
		const doc = getLocalizedDoc(value, i18n.language);
		return doc ? richTextToHtml(doc) : null;
	}, [value, i18n.language]);

	if (!html) return <>{fallback}</>;

	return (
		<div
			className={cn("text-sm", richTextClassName, className)}
			// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated from the Tiptap schema, not user-supplied markup
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
