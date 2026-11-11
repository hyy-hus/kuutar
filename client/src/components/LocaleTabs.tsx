import { useTranslation } from "react-i18next";
import { SegmentedControl } from "#/components/SegmentedControl";

/** Language order used everywhere */
export const LOCALE_ORDER = ["fi", "sv", "en"] as const;

export interface LocaleTabsProps {
	value: string;
	onChange: (lang: string) => void;
	/** Languages that have content; they get a dot */
	filled?: string[];
	/** Defaults to FI, SV, EN. Unknown extra codes are appended after these. */
	languages?: readonly string[];
	/** Accessible name; defaults to "Language" */
	"aria-label"?: string;
	className?: string;
}

/** Language tabs for localized fields, in the fixed order FI, SV, EN */
export function LocaleTabs({
	value,
	onChange,
	filled = [],
	languages = LOCALE_ORDER,
	"aria-label": ariaLabel,
	className,
}: LocaleTabsProps) {
	const { t } = useTranslation();
	const ordered = [
		...LOCALE_ORDER.filter((l) => languages.includes(l)),
		...languages.filter(
			(l) => !(LOCALE_ORDER as readonly string[]).includes(l),
		),
	];
	return (
		<SegmentedControl
			role="tablist"
			aria-label={ariaLabel ?? t("kieli", "Kieli")}
			className={className}
			value={value}
			onChange={onChange}
			options={ordered.map((lang) => ({
				value: lang,
				label: lang.toUpperCase(),
				dot: filled.includes(lang),
			}))}
		/>
	);
}
