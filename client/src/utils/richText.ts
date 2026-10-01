import { generateHTML, generateText, type JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

/** Map of language codes to Tiptap documents, e.g. `{ fi: { type: "doc", ... } }` */
export type LocalizedRichText = Record<string, JSONContent>;

/** Languages offered in rich-text editors before any content exists */
export const DEFAULT_RICH_TEXT_LANGS = ["fi", "sv", "en"];

/** Shared editor schema; rendering uses the same extensions so stored docs stay valid */
export const richTextExtensions = [
	StarterKit.configure({
		heading: { levels: [1, 2, 3] },
		link: {
			openOnClick: false,
			HTMLAttributes: {
				class:
					"text-amber-600 dark:text-amber-400 underline font-medium hover:text-amber-700 dark:hover:text-amber-300",
			},
		},
	}),
];

/** Typography for rendered and editable rich text */
export const richTextClassName = [
	"text-stone-900 dark:text-stone-100",
	"[&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:mt-4 [&_h1]:mb-2",
	"[&_h2]:text-xl [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-1",
	"[&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1",
	"[&_p]:my-1 [&_p]:leading-normal",
	"[&_a]:text-amber-600 [&_a]:dark:text-amber-400 [&_a]:underline",
	"[&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-2 [&_ul]:space-y-0.5",
	"[&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-2 [&_ol]:space-y-0.5",
	"[&_li_p]:m-0 [&_li_p]:inline",
	"[&_strong]:font-bold [&_em]:italic",
].join(" ");

const isDoc = (value: unknown): value is JSONContent =>
	typeof value === "object" &&
	value !== null &&
	(value as JSONContent).type === "doc";

/** Narrows an API description (`{ [lang]: unknown }`) to localized Tiptap documents */
export function toLocalizedRichText(value: unknown): LocalizedRichText {
	if (typeof value !== "object" || value === null) return {};
	return Object.fromEntries(
		Object.entries(value).filter((entry): entry is [string, JSONContent] =>
			isDoc(entry[1]),
		),
	);
}

/** True when a document has no visible text */
export function isEmptyDoc(doc?: JSONContent): boolean {
	return !doc || generateText(doc, richTextExtensions).trim() === "";
}

/** Drops empty languages; returns null when nothing is left so the field can be omitted */
export function compactLocalizedRichText(
	value: LocalizedRichText,
): LocalizedRichText | null {
	const entries = Object.entries(value).filter(([, doc]) => !isEmptyDoc(doc));
	return entries.length > 0 ? Object.fromEntries(entries) : null;
}

/** Picks the document for a locale, falling back to fi, en, sv and then any language */
export function getLocalizedDoc(
	value: unknown,
	locale: string,
): JSONContent | undefined {
	const docs = toLocalizedRichText(value);
	return (
		[locale, "fi", "en", "sv"]
			.map((lang) => docs[lang])
			.find((doc) => !isEmptyDoc(doc)) ??
		Object.values(docs).find((doc) => !isEmptyDoc(doc))
	);
}

/** Renders a document to HTML; only nodes and marks from the editor schema are emitted */
export function richTextToHtml(doc: JSONContent): string {
	return generateHTML(doc, richTextExtensions);
}

/** Plain-text version of a localized description, for excerpts and search */
export function getLocalizedPlainText(value: unknown, locale: string): string {
	const doc = getLocalizedDoc(value, locale);
	return doc
		? generateText(doc, richTextExtensions, { blockSeparator: " " }).trim()
		: "";
}
