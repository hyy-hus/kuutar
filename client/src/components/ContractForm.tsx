import { useForm } from "@tanstack/react-form";
import { Loader2, Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { FormActions } from "#/components/FormActions";
import { FormSection } from "#/components/FormSection";
import { Input } from "#/components/Input";
import { LocaleTabs } from "#/components/LocaleTabs";
import {
	type Contract,
	type CreateContractPayload,
	usePresignUpload,
} from "#/hooks/useContracts";

export interface ContractFormValues {
	titleMap: Record<string, string>;
	fileMap: Record<string, File | null>;
	s3KeyMap: Record<string, string>;
	fileNameMap: Record<string, string>;
	is_global: boolean;
	is_active: boolean;
	resource_ids: string[];
}

export interface ContractFormProps {
	initialData?: Contract;
	onSubmit: (payload: CreateContractPayload) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
	/** Shows a "Peruuta" button next to the submit button */
	onCancel?: () => void;
}

const DEFAULT_LANGS = ["fi", "sv", "en"];

export function ContractForm({
	initialData,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	onCancel,
}: ContractFormProps) {
	const { t, i18n } = useTranslation();
	const presignUpload = usePresignUpload();

	const existingLangs = initialData?.title
		? Object.keys(initialData.title as Record<string, string>)
		: DEFAULT_LANGS;

	const [languages, setLanguages] = useState<string[]>(
		Array.from(new Set([...DEFAULT_LANGS, ...existingLangs])),
	);
	const [activeLang, setActiveLang] = useState<string>(i18n.language || "fi");
	const [newLangInput, setNewLangInput] = useState("");
	const [isUploading, setIsUploading] = useState(false);
	const [uploadError, setUploadError] = useState<string | null>(null);

	const isGlobalId = useId();
	const isActiveId = useId();
	const addLangInputId = useId();

	const initialTitleMap = (initialData?.title as Record<string, string>) || {};
	const initialS3KeyMap = (initialData?.s3_key as Record<string, string>) || {};
	const initialFileNameMap =
		(initialData?.file_name as Record<string, string>) || {};

	const initialFileMap: Record<string, File | null> = {};
	for (const lang of languages) {
		initialFileMap[lang] = null;
	}

	const form = useForm({
		defaultValues: {
			titleMap: initialTitleMap,
			fileMap: initialFileMap,
			s3KeyMap: initialS3KeyMap,
			fileNameMap: initialFileNameMap,
			is_global: initialData?.is_global ?? false,
			is_active: initialData?.is_active ?? true,
			resource_ids: [] as string[],
		},
		onSubmit: async ({ value }) => {
			setUploadError(null);
			setIsUploading(true);

			try {
				const finalTitleMap: Record<string, string> = {};
				const finalS3KeyMap: Record<string, string> = {};
				const finalFileNameMap: Record<string, string> = {};

				for (const lang of languages) {
					const title = value.titleMap[lang]?.trim();
					const file = value.fileMap[lang];
					let s3Key = value.s3KeyMap[lang];
					let fileName = value.fileNameMap[lang];

					if (file) {
						const presign = await presignUpload.mutateAsync({
							file_name: file.name,
							content_type: file.type || "application/pdf",
						});

						const res = await fetch(presign.upload_url, {
							method: "PUT",
							headers: { "Content-Type": file.type || "application/pdf" },
							body: file,
						});

						if (!res.ok) {
							throw new Error(
								t(
									"tiedostonLatausEpäonnistui",
									"Tiedoston {{name}} lataus palvelimelle epäonnistui.",
									{ name: file.name },
								),
							);
						}

						s3Key = presign.s3_key;
						fileName = file.name;
					}

					if (title && s3Key) {
						finalTitleMap[lang] = title;
						finalS3KeyMap[lang] = s3Key;
						finalFileNameMap[lang] = fileName || "document.pdf";
					}
				}

				if (Object.keys(finalTitleMap).length === 0) {
					throw new Error(
						t(
							"vähintäänYksiKieliPakollinen",
							"Lisää otsikko ja PDF-tiedosto vähintään yhdelle kielelle.",
						),
					);
				}

				await onSubmit({
					title: finalTitleMap,
					s3_key: finalS3KeyMap,
					file_name: finalFileNameMap,
					is_global: value.is_global,
					is_active: value.is_active,
					resource_ids:
						value.resource_ids.length > 0 ? value.resource_ids : null,
				});
			} catch (err) {
				setUploadError((err as Error).message);
			} finally {
				setIsUploading(false);
			}
		},
	});

	const handleAddLanguage = () => {
		const code = newLangInput.trim().toLowerCase();
		if (code && !languages.includes(code)) {
			setLanguages([...languages, code]);
			setActiveLang(code);
			setNewLangInput("");
		}
	};

	const handleRemoveLanguage = (langToRemove: string, e: React.MouseEvent) => {
		e.stopPropagation();
		if (languages.length <= 1) return;
		const updated = languages.filter((l) => l !== langToRemove);
		setLanguages(updated);
		if (activeLang === langToRemove) {
			setActiveLang(updated[0]);
		}
	};

	const titleMap = form.getFieldValue("titleMap");
	const filledLanguages = languages.filter((lang) => {
		const hasTitle = Boolean(titleMap?.[lang]?.trim());
		const hasFile = Boolean(
			form.getFieldValue("fileMap")?.[lang] ||
				form.getFieldValue("s3KeyMap")?.[lang],
		);
		return hasTitle && hasFile;
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="w-full space-y-5"
		>
			{uploadError && <Callout variant="danger">{uploadError}</Callout>}

			<FormSection
				title={t("kieliversionTiedot", "Kieliversion tiedot")}
				description={t(
					"kieliversioKuvaus",
					"Lisää otsikko ja PDF-tiedosto vähintään yhdelle kielelle.",
				)}
			>
				{/* Language switcher & manager */}
				<div className="flex flex-wrap items-center gap-2">
					<LocaleTabs
						value={activeLang}
						onChange={setActiveLang}
						languages={languages}
						filled={filledLanguages}
					/>
					{languages.length > 1 && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={(e) => handleRemoveLanguage(activeLang, e)}
						>
							<X size={14} aria-hidden="true" />
							{`${t("poistaKieli", "Poista kieli")}: ${activeLang.toUpperCase()}`}
						</Button>
					)}
				</div>

				<div className="flex items-center gap-2">
					<label htmlFor={addLangInputId} className="sr-only">
						{t("lisaaKielikoodi", "Lisää kielikoodi")}
					</label>
					<Input
						id={addLangInputId}
						value={newLangInput}
						onChange={(e) => setNewLangInput(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								e.preventDefault();
								handleAddLanguage();
							}
						}}
						placeholder={t("esimKielikoodi", "esim. DE")}
						className="h-8 w-24 px-2 text-xs uppercase"
					/>
					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={handleAddLanguage}
					>
						<Plus size={14} aria-hidden="true" />
						{t("lisaa", "Lisää")}
					</Button>
				</div>

				{/* Title Field */}
				<form.Field name="titleMap">
					{(field) => {
						const inputId = `title-input-${activeLang}`;
						return (
							<div className="space-y-1">
								<label htmlFor={inputId} className="text-sm font-medium">
									{t("asiakirjanOtsikko", "Asiakirjan otsikko")}
									{" ("}
									{activeLang.toUpperCase()}
									{")"}
								</label>
								<Input
									id={inputId}
									value={field.state.value[activeLang] || ""}
									onChange={(e) => {
										field.handleChange({
											...field.state.value,
											[activeLang]: e.target.value,
										});
									}}
									placeholder={t(
										"esimYleisetEhdot",
										"esim. Yleiset varausehdot 2026",
									)}
								/>
							</div>
						);
					}}
				</form.Field>

				{/* File Upload Field */}
				<form.Field name="fileMap">
					{(field) => {
						const fileInputId = `file-input-${activeLang}`;
						const currentS3Key = form.getFieldValue("s3KeyMap")?.[activeLang];
						const currentFileName =
							form.getFieldValue("fileNameMap")?.[activeLang];

						return (
							<div className="space-y-1">
								<label htmlFor={fileInputId} className="text-sm font-medium">
									{t("pdfTiedosto", "PDF-tiedosto")}
									{" ("}
									{activeLang.toUpperCase()}
									{")"}
								</label>

								{currentS3Key && !field.state.value[activeLang] && (
									<p className="text-xs text-stone-600 dark:text-stone-400">
										{t("tallennettuTiedosto", "Nykyinen:")}{" "}
										<span className="font-mono">
											{currentFileName || currentS3Key}
										</span>{" "}
										{"("}
										{t("ready_in_storage", "palvelimella")}
										{")"}
									</p>
								)}

								<input
									id={fileInputId}
									type="file"
									accept="application/pdf"
									onChange={(e) => {
										const selected = e.target.files?.[0] || null;
										field.handleChange({
											...field.state.value,
											[activeLang]: selected,
										});
									}}
									className="focus-ring w-full text-sm text-stone-700 file:mr-3 file:h-8 file:cursor-pointer file:rounded-md file:border file:border-stone-400 file:bg-transparent file:px-3 file:text-xs file:font-semibold file:text-stone-900 hover:file:bg-stone-200 dark:text-stone-300 dark:file:border-stone-600 dark:file:text-stone-100 dark:hover:file:bg-stone-800"
								/>
							</div>
						);
					}}
				</form.Field>
			</FormSection>

			<FormSection title={t("asetukset", "Asetukset")}>
				<form.Field name="is_global">
					{(field) => (
						<div className="flex items-start gap-2">
							<input
								id={isGlobalId}
								type="checkbox"
								checked={field.state.value}
								onChange={(e) => field.handleChange(e.target.checked)}
								className="mt-0.5 size-4 cursor-pointer accent-stone-900 dark:accent-stone-100"
							/>
							<label
								htmlFor={isGlobalId}
								className="cursor-pointer text-sm font-medium"
							>
								{t(
									"koskeeKaikkiaResursseja",
									"Yleinen asiakirja (sovelletaan automaattisesti kaikkiin varauksiin)",
								)}
							</label>
						</div>
					)}
				</form.Field>

				<form.Field name="is_active">
					{(field) => (
						<div className="flex items-start gap-2">
							<input
								id={isActiveId}
								type="checkbox"
								checked={field.state.value}
								onChange={(e) => field.handleChange(e.target.checked)}
								className="mt-0.5 size-4 cursor-pointer accent-stone-900 dark:accent-stone-100"
							/>
							<label
								htmlFor={isActiveId}
								className="cursor-pointer text-sm font-medium"
							>
								{t(
									"asiakirjaOnAktiivinen",
									"Asiakirja on aktiivinen ja käytettävissä",
								)}
							</label>
						</div>
					)}
				</form.Field>
			</FormSection>

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, formSubmitting]) => {
					const busy = isSubmitting || formSubmitting || isUploading;
					return (
						<FormActions onCancel={onCancel}>
							<Button type="submit" disabled={!canSubmit || busy}>
								{busy ? (
									<>
										<Loader2 className="animate-spin" size={16} />
										{t(
											"ladataanTiedostoja",
											"Ladataan tiedostoja palvelimelle...",
										)}
									</>
								) : (
									(submitLabel ?? t("tallennaAsiakirja", "Tallenna asiakirja"))
								)}
							</Button>
						</FormActions>
					);
				}}
			</form.Subscribe>
		</form>
	);
}
