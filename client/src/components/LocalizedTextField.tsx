import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "#/components/Input";
import { LOCALE_ORDER, LocaleTabs } from "#/components/LocaleTabs";
import { Textarea } from "#/components/Textarea";
import type { LocalizedText } from "#/utils/localizedText";

interface LocalizedTextFieldProps {
	value: LocalizedText;
	onChange: (value: LocalizedText) => void;
	/** Visible label above the tabs; the active language is appended to the input's name */
	label: string;
	/** Shows a required marker; the field itself only needs one language */
	required?: boolean;
	/** Textarea instead of a single-line input */
	multiline?: boolean;
	maxLength?: number;
	placeholder?: string;
	/** Error under the field */
	error?: string;
	onBlur?: () => void;
}

/** Plain-text field with FI/SV/EN tabs, the plain-text sibling of `LocalizedRichTextEditor` */
export function LocalizedTextField({
	value,
	onChange,
	label,
	required = false,
	multiline = false,
	maxLength,
	placeholder,
	error,
	onBlur,
}: LocalizedTextFieldProps) {
	const { i18n } = useTranslation();
	const id = useId();
	const languages = Array.from(
		new Set<string>([...LOCALE_ORDER, ...Object.keys(value)]),
	);
	const [activeLang, setActiveLang] = useState(() =>
		languages.includes(i18n.language) ? i18n.language : languages[0],
	);
	const text = value[activeLang] ?? "";
	const inputProps = {
		id,
		value: text,
		maxLength,
		placeholder,
		isError: Boolean(error),
		"aria-required": required || undefined,
		"aria-label": `${label} (${activeLang.toUpperCase()})`,
		"aria-describedby": error ? `${id}-error` : undefined,
		onBlur,
		onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
			onChange({ ...value, [activeLang]: e.target.value }),
	};

	return (
		<div className="space-y-1.5">
			<label
				htmlFor={id}
				className="block text-sm font-medium text-stone-900 dark:text-stone-100"
			>
				{label} {required && <span aria-hidden="true">*</span>}
			</label>
			<LocaleTabs
				aria-label={label}
				value={activeLang}
				onChange={setActiveLang}
				languages={languages}
				filled={languages.filter((lang) => value[lang]?.trim())}
			/>
			{multiline ? (
				<Textarea rows={3} {...inputProps} />
			) : (
				<Input {...inputProps} />
			)}
			{maxLength !== undefined && multiline && (
				<p className="text-right text-xs tabular-nums text-stone-600 dark:text-stone-400">
					{text.length}/{maxLength}
				</p>
			)}
			{error && (
				<p
					id={`${id}-error`}
					className="text-xs text-red-600 dark:text-red-400"
				>
					{error}
				</p>
			)}
		</div>
	);
}
