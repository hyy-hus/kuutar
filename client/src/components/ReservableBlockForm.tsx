import { useForm } from "@tanstack/react-form";
import { CalendarCheck, Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Frequency } from "rrule";
import { useResources } from "#/hooks/useResorces";
import {
	formatDateTimeLocal,
	formatYYYYMMDD,
	parseLocalDate,
} from "#/utils/date";
import { generateOccurrences, parseRRule } from "#/utils/rruleUtils";
import { Button } from "./Button";
import { Input } from "./Input";

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
}

export function ReservableBlockForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
}: ReservableBlockFormProps) {
	const { t } = useTranslation();
	const { data: resources, isLoading: loadingResources } = useResources();
	// Blocks only make sense for resources that are reservable by blocks alone
	const blockResources = resources?.filter((r) => r.blocks_only);

	const initialRule = parseRRule(defaultValues?.rrule);
	const [freq, setFreq] = useState<Frequency | null>(initialRule.freq);
	const [untilStr, setUntilStr] = useState<string>(
		initialRule.until ? formatYYYYMMDD(initialRule.until) : "",
	);

	const form = useForm({
		defaultValues: {
			title: defaultValues?.title ?? "",
			description: defaultValues?.description ?? "",
			resource_ids: defaultValues?.resource_ids ?? [],
			start_time: defaultValues?.start_time ?? "",
			end_time: defaultValues?.end_time ?? "",
		},
		onSubmit: async ({ value }) => {
			const until = untilStr ? parseLocalDate(untilStr) : null;
			let occurrences: ReservableBlockOccurrenceValue[] = [];
			let rruleString: string | null = null;

			for (const resourceId of value.resource_ids) {
				const generated = generateOccurrences(
					value.start_time,
					value.end_time,
					resourceId,
					{ freq, until },
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
			className="space-y-4 max-w-xl"
		>
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
							{t("otsikko", "Otsikko")}
						</label>
						<Input
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							isError={Boolean(field.state.meta.errors.length)}
							placeholder={t("esimIltavuoro", "esim. Iltavuoro")}
						/>
					</div>
				)}
			</form.Field>

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
							className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 text-stone-900 dark:text-stone-100"
						/>
					</div>
				)}
			</form.Field>

			<div className="p-3 bg-stone-100 dark:bg-stone-900 border-2 border-emerald-300 dark:border-emerald-800 rounded-sm space-y-3">
				<div className="flex items-center gap-1.5 text-xs font-bold text-stone-800 dark:text-stone-200">
					<CalendarCheck size={16} className="text-emerald-600" />
					<span>
						{t("varausjaksonAikaJaResurssit", "Aika, resurssit ja toistuvuus")}
					</span>
				</div>

				<div className="grid grid-cols-2 gap-2">
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
									isError={Boolean(field.state.meta.errors.length)}
									onChange={(e) => field.handleChange(e.target.value)}
								/>
								{Boolean(field.state.meta.errors.length) && (
									<p className="text-[11px] text-red-500">
										{field.state.meta.errors.join(", ")}
									</p>
								)}
							</div>
						)}
					</form.Field>
				</div>

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
						<div className="space-y-1">
							<span className="text-[11px] text-stone-600 dark:text-stone-400">
								{t("varausjaksonResurssit", "Resurssit")}
							</span>
							{loadingResources ? (
								<div className="text-xs text-stone-500 py-2">
									{t("ladataanResursseja", "Ladataan resursseja...")}
								</div>
							) : blockResources && blockResources.length > 0 ? (
								<div className="flex flex-wrap gap-1.5 p-2 bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded max-h-32 overflow-y-auto">
									{blockResources.map((res) => {
										const isChecked = field.state.value.includes(res.id);
										return (
											<button
												key={res.id}
												type="button"
												onClick={() =>
													field.handleChange(
														isChecked
															? field.state.value.filter((id) => id !== res.id)
															: [...field.state.value, res.id],
													)
												}
												className={`px-2 py-1 text-xs font-medium rounded border ${
													isChecked
														? "bg-emerald-600 text-white border-emerald-600"
														: "bg-white dark:bg-stone-900 border-stone-300 dark:border-stone-700"
												}`}
											>
												{res.name}
											</button>
										);
									})}
								</div>
							) : (
								<p className="text-xs text-stone-500">
									{t(
										"eiVarausjaksoResursseja",
										"Ei resursseja, joilla on käytössä vain varausjaksot. Ota asetus käyttöön resurssin muokkauksessa.",
									)}
								</p>
							)}
							{Boolean(field.state.meta.errors.length) && (
								<p className="text-[11px] text-red-500">
									{field.state.meta.errors.join(", ")}
								</p>
							)}
						</div>
					)}
				</form.Field>

				<div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
					<div className="space-y-1">
						<label
							htmlFor="recurrence_freq"
							className="text-[11px] text-stone-600 dark:text-stone-400"
						>
							{t("toistuvuusjakso", "Toistuvuusjakso")}
						</label>
						<select
							id="recurrence_freq"
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
							<label
								htmlFor="recurrence_until"
								className="text-[11px] text-stone-600 dark:text-stone-400"
							>
								{t("toistoPttyy", "Toisto päättyy")}
							</label>
							<Input
								id="recurrence_until"
								type="date"
								value={untilStr}
								onChange={(e) => setUntilStr(e.target.value)}
							/>
						</div>
					)}
				</div>
			</div>

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, formSubmitting]) => (
					<Button
						type="submit"
						disabled={!canSubmit || isSubmitting || formSubmitting}
						className="w-full flex items-center justify-center gap-2 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
					>
						{isSubmitting || formSubmitting ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							<>
								<Save size={16} />
								<span>
									{submitLabel ??
										t("tallennaVarausjakso", "Tallenna varausjakso")}
								</span>
							</>
						)}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
