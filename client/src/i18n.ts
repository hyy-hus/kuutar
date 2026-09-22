import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import en from "../messages/en.json";
import fi from "../messages/fi.json";
import sv from "../messages/sv.json";

i18n.use(initReactI18next).init({
	resources: {
		en: { translation: en }, // Pass the un-wrapped object directly to the default 'translation' namespace
		fi: { translation: fi },
		sv: { translation: sv },
	},
	lng: "fi",
	fallbackLng: "en",
	interpolation: {
		escapeValue: false,
	},
});

export default i18n;
