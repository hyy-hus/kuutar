import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../messages/en.json";
import fi from "../messages/fi.json";
import sv from "../messages/sv.json";

export const SUPPORTED_LANGUAGES = ["fi", "en", "sv"] as const;
const DEFAULT_LANGUAGE = "fi";
const LANGUAGE_STORAGE_KEY = "kuutar.language";

/** Reads the language the user last picked; storage can be unavailable (e.g. private mode) */
function readStoredLanguage(): string | undefined {
	try {
		const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
		return SUPPORTED_LANGUAGES.find((lng) => lng === stored);
	} catch {
		return undefined;
	}
}

/** Picks the first supported language from the device's preferences, e.g. "sv-SE" → "sv" */
function detectDeviceLanguage(): string | undefined {
	const preferred =
		navigator.languages?.length > 0
			? navigator.languages
			: [navigator.language];
	for (const tag of preferred) {
		const base = tag?.split("-")[0].toLowerCase();
		const match = SUPPORTED_LANGUAGES.find((lng) => lng === base);
		if (match) return match;
	}
	return undefined;
}

i18n.on("languageChanged", (lng) => {
	document.documentElement.lang = lng;
});

/** Switches the UI language and remembers it as the user's explicit choice */
export function selectLanguage(lng: string) {
	try {
		localStorage.setItem(LANGUAGE_STORAGE_KEY, lng);
	} catch {
		// Not persisting the choice is fine; it just resets on reload
	}
	return i18n.changeLanguage(lng);
}

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en }, // Pass the un-wrapped object directly to the default 'translation' namespace
		fi: { translation: fi },
		sv: { translation: sv },
	},
	// An explicit choice wins, then the device language, then Finnish
	lng: readStoredLanguage() ?? detectDeviceLanguage() ?? DEFAULT_LANGUAGE,
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
});

export default i18n;
