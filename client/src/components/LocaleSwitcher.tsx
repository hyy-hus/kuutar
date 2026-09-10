import { useTranslation } from "react-i18next";

const LOCALES = ["fi", "en", "sv"] as const;

export default function LocaleSwitcher() {
	const { t, i18n } = useTranslation();
	const currentLocale = i18n.language || "fi";

	return (
		<div
			className="flex items-center gap-2 text-inherit"
			aria-label={t("language_label", "Kielen valinta")}
		>
			<div className="flex gap-1">
				{LOCALES.map((locale) => {
					const isActive = locale === currentLocale;
					return (
						<button
							key={locale}
							type="button"
							onClick={() => i18n.changeLanguage(locale)}
							aria-pressed={isActive}
							className={`cursor-pointer px-3 py-1.5 rounded-full border text-xs font-medium tracking-tight transition-colors ${isActive
									? "bg-stone-900 text-stone-50 border-stone-800 dark:bg-stone-100 dark:text-stone-900 font-bold"
									: "bg-transparent border-stone-300 hover:bg-stone-200 dark:border-stone-700 dark:hover:bg-stone-800"
								}`}
						>
							{locale.toUpperCase()}
						</button>
					);
				})}
			</div>
		</div>
	);
}
