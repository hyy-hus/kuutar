import { useTranslation } from "react-i18next";
import { LANGUAGE_LABELS } from "#/components/LanguageSelect";
import { SegmentedControl } from "#/components/SegmentedControl";
import { selectLanguage } from "#/i18n";
import { cn } from "#/utils/cn";

/** Display order; same as `LocaleTabs` */
const ORDER: string[] = ["fi", "sv", "en"];

interface LocaleSwitcherProps {
	/** Stretch to the container and share the width between the segments */
	fullWidth?: boolean;
}

/** FI | SV | EN switch; the full language name is the tooltip of each segment */
export default function LocaleSwitcher({ fullWidth }: LocaleSwitcherProps) {
	const { t, i18n } = useTranslation();
	const current = ORDER.includes(i18n.language) ? i18n.language : "fi";

	return (
		<SegmentedControl<string>
			aria-label={t("kieli", "Kieli")}
			value={current}
			onChange={(code) => void selectLanguage(code)}
			className={cn(
				fullWidth && "w-full [&>button]:flex-1 [&>button]:justify-center",
			)}
			options={ORDER.map((code) => ({
				value: code,
				label: (
					<span title={LANGUAGE_LABELS[code]} lang={code}>
						{code.toUpperCase()}
					</span>
				),
			}))}
		/>
	);
}
