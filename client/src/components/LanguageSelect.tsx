import { SUPPORTED_LANGUAGES } from "#/i18n";

export const LANGUAGE_LABELS: Record<string, string> = {
	fi: "Suomi",
	en: "English",
	sv: "Svenska",
};

interface LanguageSelectProps {
	id: string;
	value: string;
	onChange: (language: string) => void;
	onBlur?: () => void;
}

/** Native select for picking one of the supported languages */
export function LanguageSelect({
	id,
	value,
	onChange,
	onBlur,
}: LanguageSelectProps) {
	return (
		<select
			id={id}
			value={value}
			onChange={(e) => onChange(e.target.value)}
			onBlur={onBlur}
			className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
		>
			{SUPPORTED_LANGUAGES.map((code) => (
				<option key={code} value={code}>
					{LANGUAGE_LABELS[code]}
				</option>
			))}
		</select>
	);
}
