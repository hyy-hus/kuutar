import { useForm } from "@tanstack/react-form";
import { Globe, Loader2, Plus, Save, X } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Input } from "#/components/Input";
import {
	type Contract,
	type CreateContractPayload,
	getLocalizedText,
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
}

const DEFAULT_LANGS = ["fi", "sv", "en"];

export function ContractForm({
	initialData,
	onSubmit,
	isSubmitting = false,
	submitLabel = "Tallenna asiakirja",
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
									"Tiedoston {{name}} lataus S3-ämpäriin epäonnistui.",
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

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-5 max-w-2xl w-full"
		>
			{uploadError && (
				<div className="p-3 text-xs bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900 rounded-md">
					{uploadError}
				</div>
			)}

			{/* Language Switcher & Manager Bar */}
			<div className="flex flex-wrap items-center justify-between gap-3 p-2.5 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
				<div className="flex items-center gap-1.5 overflow-x-auto">
					<Globe size={16} className="text-stone-400 shrink-0 ml-1 mr-0.5" />
					{languages.map((lang) => {
						const isCurrent = activeLang === lang;
						const hasTitle = Boolean(
							form.getFieldValue("titleMap")?.[lang]?.trim(),
						);
						const hasFile = Boolean(
							form.getFieldValue("fileMap")?.[lang] ||
							form.getFieldValue("s3KeyMap")?.[lang],
						);
						const isLive = hasTitle && hasFile;

						return (
							<div
								key={lang}
								className={`px-2.5 py-1 text-xs font-bold font-mono uppercase rounded transition-all flex items-center gap-1.5 shrink-0 ${isCurrent
										? "bg-amber-600 text-white shadow-sm dark:bg-amber-500"
										: isLive
											? "bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 hover:bg-stone-300 dark:hover:bg-stone-700"
											: "bg-stone-200/50 dark:bg-stone-800/40 text-stone-400 dark:text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800"
									}`}
							>
								{/* Active tab select trigger */}
								<button
									type="button"
									onClick={() => setActiveLang(lang)}
									className="flex items-center gap-1.5 focus:outline-none focus:underline"
								>
									<span>{lang}</span>

									{/* Live status indicator dot */}
									<span
										className={`w-1.5 h-1.5 rounded-full shrink-0 ${isLive
												? isCurrent
													? "bg-emerald-300"
													: "bg-emerald-500"
												: "bg-stone-300 dark:bg-stone-600"
											}`}
									/>
								</button>

								{/* Semantic remove button */}
								{languages.length > 1 && (
									<button
										type="button"
										onClick={(e) => handleRemoveLanguage(lang, e)}
										aria-label={`${t("poistaKieli", "Poista kieli")}: ${lang.toUpperCase()}`}
										title={`${t("poistaKieli", "Poista kieli")}: ${lang.toUpperCase()}`}
										className={`p-0.5 rounded hover:bg-black/20 dark:hover:bg-white/20 transition-colors focus:outline-none ${isCurrent
												? "text-white/80 hover:text-white"
												: "text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
											}`}
									>
										<X size={12} />
									</button>
								)}
							</div>
						);
					})}
				</div>

				{/* Add Language Input & Button */}
				<div className="flex items-center gap-1">
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
						placeholder="ESIM. DE"
						className="w-20 text-xs uppercase h-8 px-2"
					/>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						onClick={handleAddLanguage}
						className="gap-1 text-xs h-8 px-2 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800"
					>
						<Plus size={14} />
						<span>{t("lisaa", "Lisää")}</span>
					</Button>
				</div>
			</div>

			{/* Active Language Content Section */}
			<div className="p-4 border border-stone-200 dark:border-stone-800 rounded-md space-y-4 bg-white dark:bg-stone-950">
				<div className="flex items-center justify-between pb-2 border-b border-stone-100 dark:border-stone-900">
					<span className="text-xs font-bold font-mono uppercase text-amber-600 dark:text-amber-500">
						{t("kieliversionTiedot", "Kieliversion tiedot:")} {activeLang}
					</span>
					{initialData && (
						<span className="text-[11px] text-stone-400">
							{t("nykyinenNaytto", "Esikatselu valmiina:")}{" "}
							{getLocalizedText(initialData.title, activeLang)}
						</span>
					)}
				</div>

				{/* Title Field */}
				<form.Field name="titleMap">
					{(field) => {
						const inputId = `title-input-${activeLang}`;
						return (
							<div className="space-y-1">
								<label
									htmlFor={inputId}
									className="text-xs font-medium text-stone-700 dark:text-stone-300"
								>
									{t("asiakirjanOtsikko", "Asiakirjan otsikko")} (
									{activeLang.toUpperCase()})
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
								<label
									htmlFor={fileInputId}
									className="text-xs font-medium text-stone-700 dark:text-stone-300"
								>
									{t("pdfTiedosto", "PDF-tiedosto")} ({activeLang.toUpperCase()}
									)
								</label>

								{currentS3Key && !field.state.value[activeLang] && (
									<div className="p-2 mb-2 text-xs bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded flex items-center justify-between">
										<span className="text-emerald-800 dark:text-emerald-300 font-mono truncate">
											{t("tallennettuTiedosto", "Nykyinen:")}{" "}
											{currentFileName || currentS3Key}
										</span>
										<span className="text-[10px] text-emerald-600 dark:text-emerald-400">
											{t("ready_in_storage", "palvelimella")}
										</span>
									</div>
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
									className="w-full text-xs text-stone-600 dark:text-stone-300 file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-amber-100 file:text-amber-800 dark:file:bg-amber-950 dark:file:text-amber-300 hover:file:bg-amber-200"
								/>
							</div>
						);
					}}
				</form.Field>
			</div>

			{/* Global & Active Toggles */}
			<div className="space-y-3 pt-2">
				<form.Field name="is_global">
					{(field) => (
						<div className="flex items-center gap-2">
							<input
								id={isGlobalId}
								type="checkbox"
								checked={field.state.value}
								onChange={(e) => field.handleChange(e.target.checked)}
								className="rounded border-stone-300 text-amber-600 focus:ring-amber-500"
							/>
							<label
								htmlFor={isGlobalId}
								className="text-xs text-stone-700 dark:text-stone-300 font-medium cursor-pointer"
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
						<div className="flex items-center gap-2">
							<input
								id={isActiveId}
								type="checkbox"
								checked={field.state.value}
								onChange={(e) => field.handleChange(e.target.checked)}
								className="rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
							/>
							<label
								htmlFor={isActiveId}
								className="text-xs text-stone-700 dark:text-stone-300 font-medium cursor-pointer"
							>
								{t(
									"asiakirjaOnAktiivinen",
									"Asiakirja on aktiivinen ja käytettävissä",
								)}
							</label>
						</div>
					)}
				</form.Field>
			</div>

			{/* Submit Button */}
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, formSubmitting]) => (
					<Button
						type="submit"
						disabled={
							!canSubmit || isSubmitting || formSubmitting || isUploading
						}
						className="w-full flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white mt-4"
					>
						{isSubmitting || formSubmitting || isUploading ? (
							<>
								<Loader2 className="animate-spin" size={16} />
								<span>
									{t(
										"ladataanTiedostoja",
										"Ladataan tiedostoja palvelimelle...",
									)}
								</span>
							</>
						) : (
							<>
								<Save size={16} />
								<span>{submitLabel}</span>
							</>
						)}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
