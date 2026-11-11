import type { JSONContent } from "@tiptap/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { LocaleTabs } from "#/components/LocaleTabs";
import { RichTextEditor } from "#/components/RichTextEditor";
import {
	DEFAULT_RICH_TEXT_LANGS,
	isEmptyDoc,
	type LocalizedRichText,
} from "#/utils/richText";

interface LocalizedRichTextEditorProps {
	value: LocalizedRichText;
	onChange: (value: LocalizedRichText) => void;
	/** Accessible name; the active language is appended */
	label: string;
}

/** Rich-text editor with one tab per language */
export function LocalizedRichTextEditor({
	value,
	onChange,
	label,
}: LocalizedRichTextEditorProps) {
	const { i18n } = useTranslation();
	const languages = Array.from(
		new Set([...DEFAULT_RICH_TEXT_LANGS, ...Object.keys(value)]),
	);
	const [activeLang, setActiveLang] = useState(() =>
		languages.includes(i18n.language) ? i18n.language : languages[0],
	);

	const handleChange = (doc: JSONContent) => {
		onChange({ ...value, [activeLang]: doc });
	};

	return (
		<div className="space-y-1.5">
			<LocaleTabs
				aria-label={label}
				value={activeLang}
				onChange={setActiveLang}
				languages={languages}
				filled={languages.filter((lang) => !isEmptyDoc(value[lang]))}
			/>

			{/* Remount per language so each tab edits its own document */}
			<RichTextEditor
				key={activeLang}
				value={value[activeLang]}
				onChange={handleChange}
				ariaLabel={`${label} (${activeLang.toUpperCase()})`}
			/>
		</div>
	);
}
