/** Plain text per language code, e.g. `{ fi: "Otsikko", en: "Title" }` */
export type LocalizedText = Record<string, string>;

/** Narrows an API value to localized strings, dropping anything that is not a string */
export function toLocalizedText(value: unknown): LocalizedText {
	if (typeof value !== "object" || value === null) return {};
	return Object.fromEntries(
		Object.entries(value).filter(
			(entry): entry is [string, string] => typeof entry[1] === "string",
		),
	);
}

/** Trims every language and drops the empty ones */
export function compactLocalizedText(value: LocalizedText): LocalizedText {
	return Object.fromEntries(
		Object.entries(value)
			.map(([lang, text]) => [lang, text.trim()] as const)
			.filter(([, text]) => text !== ""),
	);
}

/** Text for a locale, falling back to fi, en, sv and then any language; "" when there is none */
export function getLocalizedString(value: unknown, locale: string): string {
	const texts = toLocalizedText(value);
	const pick = (text?: string) => (text?.trim() ? text : undefined);
	return (
		[locale, "fi", "en", "sv"].map((lang) => pick(texts[lang])).find(Boolean) ??
		Object.values(texts).map(pick).find(Boolean) ??
		""
	);
}
