import type { JSONContent } from "@tiptap/core";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RichTextEditor } from "#/components/RichTextEditor";
import { cn } from "#/utils/cn";
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
			<div role="tablist" aria-label={label} className="flex gap-1">
				{languages.map((lang) => {
					const isActive = lang === activeLang;
					const hasContent = !isEmptyDoc(value[lang]);
					return (
						<button
							key={lang}
							type="button"
							role="tab"
							aria-selected={isActive}
							onClick={() => setActiveLang(lang)}
							className={cn(
								"px-2.5 py-1 text-xs font-mono font-bold uppercase rounded-sm border transition-colors flex items-center gap-1.5",
								isActive
									? "bg-stone-800 text-white border-stone-800 dark:bg-stone-200 dark:text-stone-900 dark:border-stone-200"
									: "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-400 border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800",
							)}
						>
							{lang}
							{hasContent && (
								<span
									aria-hidden="true"
									className="w-1.5 h-1.5 rounded-full bg-emerald-500"
								/>
							)}
						</button>
					);
				})}
			</div>

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
