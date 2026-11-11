import { useForm } from "@tanstack/react-form";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGroups } from "#/hooks/useGroups";
import { useResources } from "#/hooks/useResorces";
import { formatDateTimeLocal } from "#/utils/date";
import {
	generateOccurrences,
	parseRRule,
	type RRuleConfig,
} from "#/utils/rruleUtils";
import { Button } from "./Button";
import { ChipSelect } from "./ChipSelect";
import { DateTimeInput } from "./DateTimeInput";
import { FormActions } from "./FormActions";
import { FormSection } from "./FormSection";
import { GroupChecklist } from "./GroupChecklist";
import { Input } from "./Input";
import { RecurrenceFields } from "./RecurrenceFields";
import { Textarea } from "./Textarea";

export interface RestrictionOccurrenceValue {
	resource_id: string | null;
	start_time: string;
	end_time: string;
}

export interface RestrictionFormValues {
	title: string;
	description?: string;
	rrule?: string | null;
	resource_ids?: string[];
	start_time?: string;
	end_time?: string;
	exempt_group_ids: string[];
	occurrences: RestrictionOccurrenceValue[];
}

interface RestrictionFormProps {
	defaultValues?: Partial<RestrictionFormValues>;
	onSubmit: (values: RestrictionFormValues) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
	/** Shows a ghost "Peruuta" button next to the submit button */
	onCancel?: () => void;
}

function FieldError({ errors }: { errors: unknown[] }) {
	if (errors.length === 0) return null;
	return (
		<p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
			<AlertCircle size={12} aria-hidden="true" />
			{errors.join(", ")}
		</p>
	);
}

const labelClass = "text-sm font-medium text-stone-900 dark:text-stone-100";

export function RestrictionForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	onCancel,
}: RestrictionFormProps) {
	const { t } = useTranslation();
	const { data: resources, isLoading: loadingResources } = useResources();
	const { data: groups, isLoading: loadingGroups } = useGroups();

	const [recurrence, setRecurrence] = useState<RRuleConfig>(() => {
		const { dtstart: _dtstart, ...config } = parseRRule(defaultValues?.rrule);
		return config;
	});

	const form = useForm({
		defaultValues: {
			title: defaultValues?.title ?? "",
			description: defaultValues?.description ?? "",
			exempt_group_ids: defaultValues?.exempt_group_ids ?? [],
			resource_ids: defaultValues?.resource_ids ?? [],
			start_time: defaultValues?.start_time ?? "",
			end_time: defaultValues?.end_time ?? "",
			occurrences: defaultValues?.occurrences ?? [
				{ resource_id: null, start_time: "", end_time: "" },
			],
		},
		onSubmit: async ({ value }) => {
			let finalOccurrences: RestrictionOccurrenceValue[] = [];
			let rruleString: string | null = null;

			// If start_time & end_time are set, generate recurring occurrences
			if (value.start_time && value.end_time) {
				const targetResources =
					value.resource_ids && value.resource_ids.length > 0
						? value.resource_ids
						: [null];

				for (const resId of targetResources) {
					const { occurrences, rruleString: generatedRrule } =
						generateOccurrences(
							value.start_time,
							value.end_time,
							resId ?? "",
							recurrence,
						);

					finalOccurrences = [
						...finalOccurrences,
						...occurrences.map((o) => ({
							resource_id: resId,
							start_time: o.start_time,
							end_time: o.end_time,
						})),
					];
					if (generatedRrule) rruleString = generatedRrule;
				}
			} else {
				finalOccurrences = value.occurrences;
			}

			await onSubmit({
				title: value.title,
				description: value.description,
				exempt_group_ids: value.exempt_group_ids,
				rrule: rruleString,
				occurrences: finalOccurrences,
			});
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
			<FormSection title={t("perustiedot", "Perustiedot")}>
				<form.Field
					name="title"
					validators={{
						onChange: ({ value }) =>
							!value
								? t("otsikkoOnPakollinen", "Otsikko on pakollinen")
								: undefined,
					}}
				>
					{(field) => (
						<div className="space-y-1">
							<label htmlFor={field.name} className={labelClass}>
								{t("rajoituksenOtsikko", "Rajoituksen otsikko / syy")} *
							</label>
							<Input
								id={field.name}
								aria-required="true"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={Boolean(field.state.meta.errors.length)}
								placeholder={t("esimHuoltotyo", "esim. Saunan huoltotyöt")}
							/>
							<FieldError errors={field.state.meta.errors} />
						</div>
					)}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<div className="space-y-1">
							<label htmlFor={field.name} className={labelClass}>
								{t("kuvausValinnainen", "Kuvaus (valinnainen)")}
							</label>
							<Textarea
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								rows={2}
								placeholder={t("lisatietoja", "Lisätietoja käyttäjille...")}
							/>
						</div>
					)}
				</form.Field>
			</FormSection>

			<FormSection
				title={t("ajankohtaJaToistuvuus", "Ajankohta ja toistuvuus")}
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<form.Field name="start_time">
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("alkamisaika", "Alkamisaika")}
								</label>
								<DateTimeInput
									id={field.name}
									value={field.state.value}
									onChange={(e) => {
										const nextStart = e.target.value;
										const prevStart = new Date(field.state.value);
										const prevEnd = new Date(
											field.form.getFieldValue("end_time"),
										);
										const duration = prevEnd.getTime() - prevStart.getTime();

										// Keep the previous duration when the new start passes the end
										if (
											nextStart &&
											duration > 0 &&
											new Date(nextStart) >= prevEnd
										) {
											field.form.setFieldValue(
												"end_time",
												formatDateTimeLocal(
													new Date(new Date(nextStart).getTime() + duration),
												),
											);
										}
										field.handleChange(nextStart);
									}}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="end_time">
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("paattymisaika", "Päättymisaika")}
								</label>
								<DateTimeInput
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						)}
					</form.Field>
				</div>

				<form.Subscribe selector={(state) => state.values.start_time}>
					{(startTime) => (
						<RecurrenceFields
							startTime={startTime ?? ""}
							value={recurrence}
							onChange={setRecurrence}
						/>
					)}
				</form.Subscribe>
			</FormSection>

			<form.Field name="resource_ids">
				{(field) => (
					<FormSection
						title={t("koskevatResurssit", "Koskevat resurssit")}
						description={t(
							"koskevatResurssitTyhjaKaikki",
							"Jos mitään ei valita, rajoitus koskee kaikkia resursseja.",
						)}
					>
						{loadingResources ? (
							<p className="text-sm text-stone-600 dark:text-stone-400">
								{t("ladataanResursseja", "Ladataan resursseja...")}
							</p>
						) : (
							<ChipSelect
								aria-label={t("koskevatResurssit", "Koskevat resurssit")}
								options={(resources ?? []).map((res) => ({
									value: res.id,
									label: res.name,
								}))}
								value={field.state.value}
								onChange={field.handleChange}
							/>
						)}
					</FormSection>
				)}
			</form.Field>

			<form.Field name="exempt_group_ids">
				{(field) => (
					<FormSection
						title={t(
							"vapautetutRyhmat",
							"Sallitut käyttäjäryhmät (poikkeukset)",
						)}
					>
						<GroupChecklist
							groups={groups}
							loading={loadingGroups}
							value={field.state.value}
							onChange={field.handleChange}
						/>
					</FormSection>
				)}
			</form.Field>

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
							) : null}
							{submitLabel ?? t("tallennaRajoitus", "Tallenna rajoitus")}
						</Button>
					</FormActions>
				)}
			</form.Subscribe>
		</form>
	);
}
