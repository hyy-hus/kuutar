import { useForm } from "@tanstack/react-form";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DateInput } from "#/components/DateInput";
import { DateTimeInput } from "#/components/DateTimeInput";
import { FormActions } from "#/components/FormActions";
import { FormSection } from "#/components/FormSection";
import { GroupChecklist } from "#/components/GroupChecklist";
import { LocalizedRichTextEditor } from "#/components/LocalizedRichTextEditor";
import { LocalizedTextField } from "#/components/LocalizedTextField";
import { SegmentedControl } from "#/components/SegmentedControl";
import { useGroups } from "#/hooks/useGroups";
import type { News, NewsInput } from "#/hooks/useNews";
import { formatYYYYMMDD } from "#/utils/date";
import {
	type NewsVisibility,
	type PublishMode,
	toNewsFormValues,
	toNewsInput,
} from "#/utils/news";

const TITLE_MAX = 200;
const BLURB_MAX = 500;

interface NewsFormProps {
	/** The item being edited; omit for a new one */
	item?: News;
	onSubmit: (payload: NewsInput) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
	onCancel?: () => void;
}

const fieldLabel = "text-sm font-medium text-stone-900 dark:text-stone-100";
const hintText = "text-xs text-stone-600 dark:text-stone-400";
const errorText = "text-xs text-red-600 dark:text-red-400";

export function NewsForm({
	item,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	onCancel,
}: NewsFormProps) {
	const { t } = useTranslation();
	const { data: groups, isLoading: loadingGroups } = useGroups();
	const [submitError, setSubmitError] = useState<string | null>(null);

	const form = useForm({
		defaultValues: toNewsFormValues(item),
		onSubmit: async ({ value }) => {
			setSubmitError(null);
			try {
				await onSubmit(toNewsInput(value, item?.published_at));
			} catch (e) {
				setSubmitError(e instanceof Error ? e.message : String(e));
			}
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-6"
		>
			<FormSection title={t("sisalto", "Sisältö")}>
				<form.Field
					name="title"
					validators={{
						onChange: ({ value }) =>
							Object.values(value).some((text) => text.trim())
								? undefined
								: t(
										"otsikkoVahintaanYhdellaKielella",
										"Anna otsikko vähintään yhdellä kielellä.",
									),
					}}
				>
					{(field) => (
						<LocalizedTextField
							label={t("otsikko", "Otsikko")}
							required
							maxLength={TITLE_MAX}
							value={field.state.value}
							onChange={field.handleChange}
							onBlur={field.handleBlur}
							error={field.state.meta.errors.join(", ") || undefined}
						/>
					)}
				</form.Field>

				<form.Field name="blurb">
					{(field) => (
						<div className="space-y-1">
							<LocalizedTextField
								label={t("tiivistelma", "Tiivistelmä")}
								multiline
								maxLength={BLURB_MAX}
								value={field.state.value}
								onChange={field.handleChange}
							/>
							<p className={hintText}>
								{t(
									"tiivistelmaOhje",
									"Näkyy tiedotelistassa ja nostona etusivulla.",
								)}
							</p>
						</div>
					)}
				</form.Field>

				<form.Field name="body">
					{(field) => (
						<div className="space-y-1">
							<span className={fieldLabel}>{t("teksti", "Teksti")}</span>
							<LocalizedRichTextEditor
								value={field.state.value}
								onChange={field.handleChange}
								label={t("teksti", "Teksti")}
							/>
						</div>
					)}
				</form.Field>
			</FormSection>

			<FormSection
				title={t("nakyvyys", "Näkyvyys")}
				description={t(
					"nakyvyysOhje",
					"Ylläpitäjät näkevät aina kaikki tiedotteet.",
				)}
			>
				<form.Field name="visibility">
					{(field) => (
						<SegmentedControl<NewsVisibility>
							aria-label={t("nakyvyys", "Näkyvyys")}
							value={field.state.value}
							onChange={field.handleChange}
							options={[
								{ value: "public", label: t("kaikille", "Kaikille") },
								{
									value: "users",
									label: t("kirjautuneille", "Kirjautuneille"),
								},
								{
									value: "groups",
									label: t("valituilleRyhmille", "Valituille ryhmille"),
								},
							]}
						/>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.visibility}>
					{(visibility) => (
						<p className={hintText}>
							{visibility === "public"
								? t(
										"nakyvyysKaikilleOhje",
										"Näkyy kaikille, myös kirjautumattomille.",
									)
								: visibility === "users"
									? t(
											"nakyvyysKirjautuneilleOhje",
											"Näkyy kaikille kirjautuneille käyttäjille.",
										)
									: t(
											"nakyvyysRyhmilleOhje",
											"Näkyy vain valittujen ryhmien jäsenille.",
										)}
						</p>
					)}
				</form.Subscribe>

				<form.Subscribe selector={(state) => state.values.visibility}>
					{(visibility) =>
						visibility === "groups" && (
							<form.Field
								name="visibleGroupIds"
								validators={{
									onChangeListenTo: ["visibility"],
									onChange: ({ value, fieldApi }) =>
										fieldApi.form.getFieldValue("visibility") === "groups" &&
										value.length === 0
											? t(
													"valitseVahintaanYksiRyhma",
													"Valitse vähintään yksi ryhmä.",
												)
											: undefined,
								}}
							>
								{(field) => (
									<fieldset className="space-y-1">
										<legend className={fieldLabel}>
											{t("ryhmat", "Ryhmät")}
										</legend>
										<GroupChecklist
											groups={groups}
											loading={loadingGroups}
											value={field.state.value}
											onChange={field.handleChange}
										/>
										{field.state.meta.errors.length > 0 && (
											<p className={errorText}>
												{field.state.meta.errors.join(", ")}
											</p>
										)}
									</fieldset>
								)}
							</form.Field>
						)
					}
				</form.Subscribe>
			</FormSection>

			<FormSection title={t("julkaisu", "Julkaisu")}>
				<form.Field name="publishMode">
					{(field) => (
						<SegmentedControl<PublishMode>
							aria-label={t("julkaisu", "Julkaisu")}
							value={field.state.value}
							onChange={field.handleChange}
							options={[
								{ value: "draft", label: t("luonnos", "Luonnos") },
								{ value: "publish", label: t("julkaise", "Julkaise") },
								{ value: "schedule", label: t("ajasta", "Ajasta") },
							]}
						/>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.publishMode}>
					{(mode) =>
						mode === "schedule" ? (
							<form.Field
								name="scheduledAt"
								validators={{
									onChangeListenTo: ["publishMode"],
									onChange: ({ value, fieldApi }) => {
										if (
											fieldApi.form.getFieldValue("publishMode") !== "schedule"
										)
											return undefined;
										if (!value)
											return t("valitseJulkaisuaika", "Valitse julkaisuaika.");
										return new Date(value) <= new Date()
											? t(
													"julkaisuaikaTulevaisuudessa",
													"Ajastetun julkaisuajan on oltava tulevaisuudessa.",
												)
											: undefined;
									},
								}}
							>
								{(field) => {
									const hasError = field.state.meta.errors.length > 0;
									return (
										<div className="max-w-xs space-y-1">
											<label htmlFor={field.name} className={fieldLabel}>
												{t("julkaisuaika", "Julkaisuaika")}{" "}
												<span aria-hidden="true">*</span>
											</label>
											<DateTimeInput
												id={field.name}
												aria-required="true"
												value={field.state.value}
												onChange={(e) => field.handleChange(e.target.value)}
												onBlur={field.handleBlur}
												isError={hasError}
											/>
											{hasError && (
												<p className={errorText}>
													{field.state.meta.errors.join(", ")}
												</p>
											)}
										</div>
									);
								}}
							</form.Field>
						) : (
							<p className={hintText}>
								{mode === "draft"
									? t("luonnosOhje", "Luonnos näkyy vain ylläpitäjille.")
									: t(
											"julkaiseOhje",
											"Tiedote näkyy heti tallennuksen jälkeen.",
										)}
							</p>
						)
					}
				</form.Subscribe>

				<form.Field name="highlighted">
					{(field) => (
						<label className="flex items-start gap-2 text-sm">
							<input
								type="checkbox"
								className="mt-0.5 size-4 rounded border-stone-400 text-purple-600 focus:ring-purple-500"
								checked={field.state.value}
								onChange={(e) => field.handleChange(e.target.checked)}
							/>
							<span>
								<span className="font-medium text-stone-900 dark:text-stone-100">
									{t("nostaEtusivulle", "Nosta etusivulle")}
								</span>
								<span className={`block ${hintText}`}>
									{t(
										"nostaEtusivulleOhje",
										"Tiivistelmä näkyy etusivulla, kunnes käyttäjä lukee tai piilottaa sen.",
									)}
								</span>
							</span>
						</label>
					)}
				</form.Field>

				<form.Subscribe selector={(state) => state.values.highlighted}>
					{(highlighted) =>
						highlighted && (
							<form.Field name="highlightUntil">
								{(field) => (
									<div className="max-w-xs space-y-1 pl-6">
										<label htmlFor={field.name} className={fieldLabel}>
											{t("nostoPaattyy", "Nosto päättyy")}
										</label>
										<DateInput
											id={field.name}
											min={formatYYYYMMDD(new Date())}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
										/>
										<p className={hintText}>
											{t(
												"nostoPaattyyOhje",
												"Viimeinen päivä etusivulla. Jätä tyhjäksi, jos nosto on voimassa toistaiseksi.",
											)}
										</p>
									</div>
								)}
							</form.Field>
						)
					}
				</form.Subscribe>
			</FormSection>

			{submitError && <Callout variant="danger">{submitError}</Callout>}

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, formSubmitting]) => (
					<FormActions onCancel={onCancel}>
						<Button
							type="submit"
							disabled={!canSubmit || isSubmitting || formSubmitting}
						>
							{isSubmitting || formSubmitting ? (
								<Loader2 className="animate-spin" size={16} />
							) : (
								<Save size={16} />
							)}
							<span>{submitLabel ?? t("tallenna", "Tallenna")}</span>
						</Button>
					</FormActions>
				)}
			</form.Subscribe>
		</form>
	);
}
