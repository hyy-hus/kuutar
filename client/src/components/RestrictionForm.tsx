import { useForm } from "@tanstack/react-form";
import {
	AlertOctagon,
	Loader2,
	Plus,
	RefreshCw,
	Save,
	Trash2,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Frequency } from "rrule";
import { Button } from "./Button";
import { Input } from "./Input";
import { useGroups } from "#/hooks/useGroups";
import { useResources } from "#/hooks/useResorces";
import { generateOccurrences, parseRRule } from "#/utils/rruleUtils";

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
	submitLabel = "Tallenna rajoitus",
}: RestrictionFormProps) {
	const { t } = useTranslation();
	const { data: resources, isLoading: loadingResources } = useResources();
	const { data: groups, isLoading: loadingGroups } = useGroups();

	const initialRule = parseRRule(defaultValues?.rrule);

	const formatDateInput = (date?: Date | null) => {
		if (!date) return "";
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, "0");
		const day = String(date.getDate()).padStart(2, "0");
		return `${year}-${month}-${day}`;
	};

	const [freq, setFreq] = useState<Frequency | null>(initialRule.freq);
	const [untilStr, setUntilStr] = useState<string>(
		formatDateInput(initialRule.until),
	);

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
				const until = untilStr ? new Date(untilStr) : null;
				const targetResources =
					value.resource_ids && value.resource_ids.length > 0
						? value.resource_ids
						: [null];

				for (const resId of targetResources) {
					const { occurrences, rruleString: generatedRrule } =
						generateOccurrences(value.start_time, value.end_time, resId ?? "", {
							freq,
							until,
						});

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
							{t("kuvaus", "Kuvaus (valinnainen)")}
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
								<label className="text-[11px] text-stone-600 dark:text-stone-400">
									{t("alkamisaika", "Alkamisaika")}
								</label>
								<Input
									type="datetime-local"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
							</div>
						)}
					</form.Field>

					<form.Field name="end_time">
						{(field) => (
							<div className="space-y-1">
								<label className="text-[11px] text-stone-600 dark:text-stone-400">
									{t("paattymisaika", "Päättymisaika")}
								</label>
								<Input
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
											className={`px-2 py-1 text-xs font-medium rounded border ${isChecked
													? "bg-amber-600 text-white border-amber-600"
													: "bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
												}`}
										>
											{res.name}
										</button>
									);
								})}
							</div>
						</div>
					)}
				</form.Field>

				{/* Recurrence Rule Controls */}
				<div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
					<div className="space-y-1">
						<label className="text-[11px] text-stone-600 dark:text-stone-400">
							{t("toistuvuusjakso", "Toistuvuusjakso")}
						</label>
						<select
							value={freq === null ? "none" : freq}
							onChange={(e) => {
								const val = e.target.value;
								setFreq(val === "none" ? null : Number(val));
							}}
							className="w-full px-2 py-1 text-xs bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded"
						>
							<option value="none">{t("eiToistoa", "Ei toistoa")}</option>
							<option value={Frequency.DAILY}>
								{t("pivittin", "Päivittäin")}
							</option>
							<option value={Frequency.WEEKLY}>
								{t("viikoittain", "Viikoittain")}
							</option>
							<option value={Frequency.MONTHLY}>
								{t("kuukausittain", "Kuukausittain")}
							</option>
							<option value={Frequency.YEARLY}>
								{t("vuosittain", "Vuosittain")}
							</option>
						</select>
					</div>

					{freq !== null && (
						<div className="space-y-1">
							<label className="text-[11px] text-stone-600 dark:text-stone-400">
								{t("toistoPttyy", "Toisto päättyy")}
							</label>
							<Input
								type="date"
								value={untilStr}
								onChange={(e) => setUntilStr(e.target.value)}
							/>
						</div>
					)}
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

						{loadingGroups ? (
							<div className="text-xs text-stone-500 py-2">
								{t("ladataanRyhmia", "Ladataan ryhmiä...")}
							</div>
						) : (
							<div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
								{groups?.map((grp) => {
									const isChecked = field.state.value.includes(grp.id);
									return (
										<label
											key={grp.id}
											className="flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 font-medium cursor-pointer p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"
										>
											<input
												type="checkbox"
												checked={isChecked}
												onChange={(e) => {
													const next = e.target.checked
														? [...field.state.value, grp.id]
														: field.state.value.filter((id) => id !== grp.id);
													field.handleChange(next);
												}}
												className="w-4 h-4 text-emerald-600 rounded border-stone-300 focus:ring-emerald-500"
											/>
											<span>{grp.name}</span>
										</label>
									);
								})}
							</div>
						)}
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
								<span>{submitLabel}</span>
							</>
						)}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
