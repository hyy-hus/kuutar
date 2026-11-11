import type { JSONContent } from "@tiptap/core";
import { Loader2, RotateCcw, Save, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { Input } from "#/components/Input";
import { LocaleTabs } from "#/components/LocaleTabs";
import { RichTextEditor } from "#/components/RichTextEditor";
import {
	type EmailTemplate,
	useEmailTemplatePreview,
	useResetEmailTemplate,
	useSaveEmailTemplate,
	useSendTestEmail,
} from "#/hooks/useEmailTemplates";
import { SUPPORTED_LANGUAGES } from "#/i18n";
import {
	compactLocalizedRichText,
	isEmptyDoc,
	type LocalizedRichText,
	toLocalizedRichText,
} from "#/utils/richText";

const PREVIEW_DEBOUNCE_MS = 500;

/** Links in the preview use the app accent (purple-700) instead of the browser default blue */
const PREVIEW_STYLE = "<style>a{color:#7e22ce}</style>";

function withAccentLinks(html: string | undefined): string {
	if (!html) return "";
	// Keep any doctype first: a style tag before it would switch the iframe to quirks mode
	return /<\/head>/i.test(html)
		? html.replace(/<\/head>/i, `${PREVIEW_STYLE}</head>`)
		: html + PREVIEW_STYLE;
}

interface EmailTemplateEditorProps {
	template: EmailTemplate;
}

type Subjects = Record<string, string>;

/** Edits one notification email: subject and body per language, with a live preview */
export function EmailTemplateEditor({ template }: EmailTemplateEditorProps) {
	const { t, i18n } = useTranslation();
	const [subjects, setSubjects] = useState<Subjects>(template.subject);
	const [bodies, setBodies] = useState<LocalizedRichText>(() =>
		toLocalizedRichText(template.body),
	);
	const [lang, setLang] = useState<string>(
		SUPPORTED_LANGUAGES.find((l) => l === i18n.language) ?? "fi",
	);
	const [notice, setNotice] = useState<{
		kind: "success" | "error";
		text: string;
	} | null>(null);

	const save = useSaveEmailTemplate();
	const reset = useResetEmailTemplate();
	const sendTest = useSendTestEmail();
	const preview = useEmailTemplatePreview();

	const variableLabels: Record<string, string> = {
		user_name: t("vastaanottajanNimi", "Vastaanottajan nimi"),
		email: t("sahkopostiosoite", "Sähköpostiosoite"),
		app_url: t("sovelluksenOsoite", "Sovelluksen osoite"),
		title: t("varauksenOtsikko", "Varauksen otsikko"),
		status: t("varauksenTila", "Varauksen tila"),
		contact_person: t("yhteyshenkilo", "Yhteyshenkilö"),
		occurrences: t("ajankohdatJaResurssit", "Ajankohdat ja resurssit"),
		reservation_url: t("varauksenOsoite", "Varauksen osoite"),
	};
	const insertables = template.variables.map((name) => ({
		label: variableLabels[name] ?? name,
		text: `{{${name}}}`,
	}));

	const filledLanguages = SUPPORTED_LANGUAGES.filter((code) => {
		const doc = bodies[code];
		return (subjects[code] ?? "").trim() !== "" || (doc && !isEmptyDoc(doc));
	});
	const subject = subjects[lang] ?? "";
	const body: JSONContent | undefined = bodies[lang];

	// Subjects must be non-empty; empty bodies fall back to the built-in default
	const subjectsValid = Object.values(subjects).every((s) => s.trim() !== "");
	const payload = useMemo(
		() => ({
			subject: subjects,
			body: compactLocalizedRichText(bodies) ?? {},
		}),
		[subjects, bodies],
	);
	const isDirty =
		JSON.stringify(payload.subject) !== JSON.stringify(template.subject) ||
		JSON.stringify(payload.body) !==
			JSON.stringify(
				compactLocalizedRichText(toLocalizedRichText(template.body)) ?? {},
			);

	// Debounced server-side render of the unsaved edits with sample data
	const { mutate: renderPreview } = preview;
	useEffect(() => {
		if (!subject.trim()) return;
		const timer = setTimeout(() => {
			renderPreview({
				key: template.key,
				payload: {
					language: lang,
					subject: { [lang]: subject },
					body: body && !isEmptyDoc(body) ? { [lang]: body } : undefined,
				},
			});
		}, PREVIEW_DEBOUNCE_MS);
		return () => clearTimeout(timer);
	}, [template.key, lang, subject, body, renderPreview]);

	const showError = (error: unknown) =>
		setNotice({
			kind: "error",
			text: error instanceof Error ? error.message : String(error),
		});

	const handleSave = () => {
		setNotice(null);
		save.mutate(
			{ key: template.key, payload },
			{
				onSuccess: () =>
					setNotice({
						kind: "success",
						text: t("pohjaTallennettu", "Pohja tallennettu."),
					}),
				onError: showError,
			},
		);
	};

	const handleReset = () => {
		if (
			!window.confirm(
				t(
					"palautetaankoOletuspohja",
					"Palautetaanko oletuspohja? Omat muutoksesi poistetaan.",
				),
			)
		)
			return;
		setNotice(null);
		reset.mutate(template.key, {
			onSuccess: (restored) => {
				setSubjects(restored.subject);
				setBodies(toLocalizedRichText(restored.body));
				setNotice({
					kind: "success",
					text: t("oletuspohjaPalautettu", "Oletuspohja palautettu."),
				});
			},
			onError: showError,
		});
	};

	const handleSendTest = () => {
		setNotice(null);
		sendTest.mutate(
			{
				key: template.key,
				payload: {
					language: lang,
					subject: { [lang]: subject },
					body: body && !isEmptyDoc(body) ? { [lang]: body } : undefined,
				},
			},
			{
				onSuccess: () =>
					setNotice({
						kind: "success",
						text: t(
							"testiviestiLahetetty",
							"Testiviesti lähetetty sähköpostiisi.",
						),
					}),
				onError: showError,
			},
		);
	};

	return (
		<div className="grid grid-cols-1 xl:grid-cols-2 gap-4 min-w-0">
			<div className="space-y-3 min-w-0">
				<LocaleTabs
					value={lang}
					onChange={setLang}
					filled={filledLanguages}
					languages={SUPPORTED_LANGUAGES}
				/>

				<div className="space-y-1">
					<label
						htmlFor={`subject-${template.key}`}
						className="text-sm font-medium"
					>
						{t("otsikko", "Otsikko")}
					</label>
					<Input
						id={`subject-${template.key}`}
						value={subject}
						onChange={(e) =>
							setSubjects((prev) => ({ ...prev, [lang]: e.target.value }))
						}
						isError={subject.trim() === ""}
					/>
				</div>

				<div className="space-y-1">
					<span className="text-sm font-medium">{t("viesti", "Viesti")}</span>
					{/* Remount per language so each tab edits its own document */}
					<RichTextEditor
						key={`${template.key}-${lang}`}
						value={body}
						onChange={(doc) => setBodies((prev) => ({ ...prev, [lang]: doc }))}
						ariaLabel={`${t("viesti", "Viesti")} (${lang.toUpperCase()})`}
						insertables={insertables}
					/>
				</div>

				<div className="flex flex-wrap items-center gap-2 pt-1">
					<Button
						onClick={handleSave}
						disabled={!isDirty || !subjectsValid || save.isPending}
						className="gap-1.5"
					>
						{save.isPending ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Save size={16} />
						)}
						{t("tallenna", "Tallenna")}
					</Button>
					<Button
						variant="outline"
						onClick={handleSendTest}
						disabled={!subject.trim() || sendTest.isPending}
						className="gap-1.5"
					>
						{sendTest.isPending ? (
							<Loader2 size={16} className="animate-spin" />
						) : (
							<Send size={16} />
						)}
						{t("lahetaTestiviesti", "Lähetä testiviesti minulle")}
					</Button>
					{template.customized && (
						<Button
							variant="ghost"
							onClick={handleReset}
							disabled={reset.isPending}
							className="gap-1.5"
						>
							<RotateCcw size={16} />
							{t("palautaOletus", "Palauta oletus")}
						</Button>
					)}
				</div>

				{notice && (
					<Callout variant={notice.kind === "success" ? "success" : "danger"}>
						{notice.text}
					</Callout>
				)}
			</div>

			<div className="space-y-2 min-w-0">
				<h2 className="text-lg font-semibold">
					{t("esikatselu", "Esikatselu")}
				</h2>
				<p className="text-xs text-stone-600 dark:text-stone-400">
					{t(
						"esikatseluEsimerkkitiedoilla",
						"Muuttujat korvataan esimerkkitiedoilla.",
					)}
				</p>
				<div className="overflow-hidden rounded-md border border-stone-300 bg-white dark:border-stone-700">
					<div className="px-3 py-2 text-xs border-b border-stone-200 bg-stone-50 text-stone-900 truncate">
						<span className="text-stone-600">{`${t("aihe", "Aihe")}: `}</span>
						{preview.data?.subject ?? ""}
					</div>
					{/* Sandboxed: previews render admin-authored HTML */}
					<iframe
						title={t("esikatselu", "Esikatselu")}
						sandbox=""
						srcDoc={withAccentLinks(preview.data?.html)}
						className="w-full min-h-[320px] bg-white"
					/>
				</div>
				{preview.isError && (
					<Callout variant="danger">{preview.error.message}</Callout>
				)}
			</div>
		</div>
	);
}
