import { Select } from "#/components/Select";
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
	/** `sm` for filter bars and toolbars (default `md`) */
	size?: "sm" | "md";
	"aria-label"?: string;
}

/** Native select for picking one of the supported languages */
export function LanguageSelect({
	id,
	value,
	onChange,
	onBlur,
	size,
	"aria-label": ariaLabel,
}: LanguageSelectProps) {
	return (
		<Select
			id={id}
			value={value}
			size={size}
			aria-label={ariaLabel}
			onChange={(e) => onChange(e.target.value)}
			onBlur={onBlur}
		>
			{SUPPORTED_LANGUAGES.map((code) => (
				<option key={code} value={code}>
					{LANGUAGE_LABELS[code]}
				</option>
			))}
		</Select>
	);
}
