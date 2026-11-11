import { useForm } from "@tanstack/react-form";
import { AlertCircle, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Input } from "./Input";
import { RecurrenceFields } from "./RecurrenceFields";
import { Textarea } from "./Textarea";

export interface ReservableBlockOccurrenceValue {
	resource_id: string;
	start_time: string;
	end_time: string;
}

export interface ReservableBlockFormValues {
	title: string;
	description?: string;
	rrule?: string | null;
	resource_ids?: string[];
	start_time?: string;
	end_time?: string;
	occurrences: ReservableBlockOccurrenceValue[];
}

interface ReservableBlockFormProps {
	defaultValues?: Partial<ReservableBlockFormValues>;
	onSubmit: (values: ReservableBlockFormValues) => Promise<void>;
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

export function ReservableBlockForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	onCancel,
}: ReservableBlockFormProps) {
	const { t } = useTranslation();
	const { data: resources, isLoading: loadingResources } = useResources();
	// Blocks only make sense for resources that are reservable by blocks alone
	const blockResources = resources?.filter((r) => r.blocks_only);

	const [recurrence, setRecurrence] = useState<RRuleConfig>(() => {
		const { dtstart: _dtstart, ...config } = parseRRule(defaultValues?.rrule);
		return config;
	});

	const form = useForm({
		defaultValues: {
			title: defaultValues?.title ?? "",
			description: defaultValues?.description ?? "",
			resource_ids: defaultValues?.resource_ids ?? [],
			start_time: defaultValues?.start_time ?? "",
			end_time: defaultValues?.end_time ?? "",
		},
		onSubmit: async ({ value }) => {
			let occurrences: ReservableBlockOccurrenceValue[] = [];
			let rruleString: string | null = null;

			for (const resourceId of value.resource_ids) {
				const generated = generateOccurrences(
					value.start_time,
					value.end_time,
					resourceId,
					recurrence,
				);
				occurrences = [
					...occurrences,
					...generated.occurrences.map((o) => ({
						resource_id: resourceId,
						start_time: o.start_time,
						end_time: o.end_time,
					})),
				];
				if (generated.rruleString) rruleString = generated.rruleString;
			}

			await onSubmit({
				title: value.title,
				description: value.description,
				rrule: rruleString,
				occurrences,
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
								{t("otsikko", "Otsikko")} *
							</label>
							<Input
								id={field.name}
								aria-required="true"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={Boolean(field.state.meta.errors.length)}
								placeholder={t("esimIltavuoro", "esim. Iltavuoro")}
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
							/>
						</div>
					)}
				</form.Field>
			</FormSection>

			<FormSection
				title={t("ajankohtaJaToistuvuus", "Ajankohta ja toistuvuus")}
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<form.Field
						name="start_time"
						validators={{
							onChange: ({ value }) =>
								!value
									? t("valitseAlkamisaika", "Alkamisaika on pakollinen.")
									: undefined,
						}}
					>
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("alkamisaika", "Alkamisaika")} *
								</label>
								<DateTimeInput
									id={field.name}
									aria-required="true"
									value={field.state.value}
									isError={Boolean(field.state.meta.errors.length)}
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

					<form.Field
						name="end_time"
						validators={{
							onChangeListenTo: ["start_time"],
							onChange: ({ value, fieldApi }) => {
								if (!value)
									return t(
										"valitsePaattymisaika",
										"Päättymisaika on pakollinen.",
									);
								const start = fieldApi.form.getFieldValue("start_time");
								if (start && new Date(value) <= new Date(start)) {
									return t(
										"paattymisaikaEnnenAlkamisaikaa",
										"Päättymisajan on oltava alkamisajan jälkeen.",
									);
								}
								return undefined;
							},
						}}
					>
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("paattymisaika", "Päättymisaika")} *
								</label>
								<DateTimeInput
									id={field.name}
									aria-required="true"
									value={field.state.value}
									isError={Boolean(field.state.meta.errors.length)}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								<FieldError errors={field.state.meta.errors} />
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

			<form.Field
				name="resource_ids"
				validators={{
					onChange: ({ value }) =>
						value.length === 0
							? t(
									"valitseVhintnYksiResurssi",
									"Valitse vähintään yksi resurssi",
								)
							: undefined,
				}}
			>
				{(field) => (
					<FormSection title={t("varausjaksonResurssit", "Resurssit")}>
						{loadingResources ? (
							<p className="text-sm text-stone-600 dark:text-stone-400">
								{t("ladataanResursseja", "Ladataan resursseja...")}
							</p>
						) : blockResources && blockResources.length > 0 ? (
							<ChipSelect
								aria-label={t("varausjaksonResurssit", "Resurssit")}
								options={blockResources.map((res) => ({
									value: res.id,
									label: res.name,
								}))}
								value={field.state.value}
								onChange={field.handleChange}
							/>
						) : (
							<p className="text-sm text-stone-600 dark:text-stone-400">
								{t(
									"eiVarausjaksoResursseja",
									"Ei resursseja, joilla on käytössä vain varausjaksot. Ota asetus käyttöön resurssin muokkauksessa.",
								)}
							</p>
						)}
						<FieldError errors={field.state.meta.errors} />
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
							{submitLabel ?? t("tallennaVarausjakso", "Tallenna varausjakso")}
						</Button>
					</FormActions>
				)}
			</form.Subscribe>
		</form>
	);
}
