import { useForm } from "@tanstack/react-form";
import { AlertOctagon, Loader2, Save, Users } from "lucide-react";
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
import { GroupChecklist } from "./GroupChecklist";
import { Input } from "./Input";
import { RecurrenceFields } from "./RecurrenceFields";

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
}

export function RestrictionForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
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
			className="space-y-4 max-w-xl"
		>
			{/* Title */}
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
						<label
							htmlFor={field.name}
							className="text-xs font-medium text-stone-700 dark:text-stone-300"
						>
							{t("rajoituksenOtsikko", "Rajoituksen otsikko / syy")}
						</label>
						<Input
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							isError={Boolean(field.state.meta.errors.length)}
							placeholder={t("esimHuoltotyo", "esim. Saunan huoltotyöt")}
						/>
					</div>
				)}
			</form.Field>

			{/* Description */}
			<form.Field name="description">
				{(field) => (
					<div className="space-y-1">
						<label
							htmlFor={field.name}
							className="text-xs font-medium text-stone-700 dark:text-stone-300"
						>
							{t("kuvausValinnainen", "Kuvaus (valinnainen)")}
						</label>
						<textarea
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							rows={2}
							className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-stone-900 dark:text-stone-100"
							placeholder={t("lisatietoja", "Lisätietoja käyttäjille...")}
						/>
					</div>
				)}
			</form.Field>

			{/* Generator Time Range & Recurrence */}
			<div className="p-3 bg-stone-100 dark:bg-stone-900 border-2 border-amber-300 dark:border-amber-800 rounded-sm space-y-3">
				<div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
					<AlertOctagon size={16} className="text-amber-600" />
					<span>
						{t(
							"aikaJaToistuvuus",
							"Ajanvaraus, koskevat resurssit ja toistuvuus",
						)}
					</span>
				</div>

				<div className="grid grid-cols-2 gap-2">
					<form.Field name="start_time">
						{(field) => (
							<div className="space-y-1">
								<label
									htmlFor={field.name}
									className="text-[11px] text-stone-600 dark:text-stone-400"
								>
									{t("alkamisaika", "Alkamisaika")}
								</label>
								<Input
									id={field.name}
									type="datetime-local"
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
								<label
									htmlFor={field.name}
									className="text-[11px] text-stone-600 dark:text-stone-400"
								>
									{t("paattymisaika", "Päättymisaika")}
								</label>
								<Input
									id={field.name}
									type="datetime-local"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						)}
					</form.Field>
				</div>

				{/* Multi-Resource Selector for Recurring Generator */}
				<form.Field name="resource_ids">
					{(field) => (
						<div className="space-y-1">
							<span className="text-[11px] text-stone-600 dark:text-stone-400">
								{t(
									"koskevatResurssitTyhjaGlobaali",
									"Koskevat resurssit (Tyhjä = kaikkia koskeva)",
								)}
							</span>
							{loadingResources ? (
								<div className="text-xs text-stone-500 py-2">
									{t("ladataanResursseja", "Ladataan resursseja...")}
								</div>
							) : (
								<div className="flex flex-wrap gap-1.5 p-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded max-h-32 overflow-y-auto">
									{resources?.map((res) => {
										const isChecked = field.state.value.includes(res.id);
										return (
											<button
												key={res.id}
												type="button"
												onClick={() => {
													const next = isChecked
														? field.state.value.filter((id) => id !== res.id)
														: [...field.state.value, res.id];
													field.handleChange(next);
												}}
												className={`px-2 py-1 text-xs font-medium rounded border ${
													isChecked
														? "bg-amber-600 text-white border-amber-600"
														: "bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
												}`}
											>
												{res.name}
											</button>
										);
									})}
								</div>
							)}
						</div>
					)}
				</form.Field>

				<div className="pt-2 border-t border-stone-200 dark:border-stone-800">
					<form.Subscribe selector={(state) => state.values.start_time}>
						{(startTime) => (
							<RecurrenceFields
								startTime={startTime ?? ""}
								value={recurrence}
								onChange={setRecurrence}
							/>
						)}
					</form.Subscribe>
				</div>
			</div>

			{/* Group Exemptions */}
			<form.Field name="exempt_group_ids">
				{(field) => (
					<div className="space-y-1.5 pt-2 border-t border-stone-200 dark:border-stone-800">
						<div className="flex items-center gap-1.5">
							<Users
								size={14}
								className="text-emerald-600 dark:text-emerald-500"
							/>
							<span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
								{t("vapautetutRyhmat", "Sallitut käyttäjäryhmät (poikkeukset)")}
							</span>
						</div>

						<GroupChecklist
							groups={groups}
							loading={loadingGroups}
							value={field.state.value}
							onChange={field.handleChange}
							className="bg-stone-50 dark:bg-stone-900"
							checkboxClassName="text-emerald-600 focus:ring-emerald-500"
						/>
					</div>
				)}
			</form.Field>

			{/* Submit Button */}
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, formSubmitting]) => (
					<Button
						type="submit"
						disabled={!canSubmit || isSubmitting || formSubmitting}
						className="w-full flex items-center justify-center gap-2 mt-4 bg-amber-600 hover:bg-amber-700 text-white"
					>
						{isSubmitting || formSubmitting ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							<>
								<Save size={16} />
								<span>
									{submitLabel ?? t("tallennaRajoitus", "Tallenna rajoitus")}
								</span>
							</>
						)}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
