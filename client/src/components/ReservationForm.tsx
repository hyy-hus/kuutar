import { useForm } from "@tanstack/react-form";
import {
	AlertTriangle,
	CheckCircle2,
	Loader2,
	RefreshCw,
	Save,
	ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Frequency } from "rrule";
import { Button } from "#/components/Button";
import { Input } from "#/components/Input";
import { useIsAdmin } from "#/hooks/useAuth";
import {
	type CreateOccurrencePayload,
	type Occurrence,
	type ReservationStatus,
	useCheckConflicts,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import {
	type RestrictionWithOccurrences,
	useRestrictions,
} from "#/hooks/useRestrictions";
import { formatDate } from "#/utils/date";
import { generateOccurrences, parseRRule } from "#/utils/rruleUtils";

export interface ReservationFormValues {
	title: string;
	description?: string;
	status?: ReservationStatus;
	admin_notes?: string;
	resource_ids?: string[];
	start_time?: string;
	end_time?: string;
	rrule?: string | null;
	occurrences?: CreateOccurrencePayload[];
}

interface ReservationFormProps {
	defaultValues?: Partial<ReservationFormValues> & { resource_id?: string };
	onSubmit: (values: ReservationFormValues) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
	isCreate?: boolean;
}

export function ReservationForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel = "Tallenna",
}: ReservationFormProps) {
	const { t } = useTranslation();
	const { data: resources, isLoading: loadingResources } = useResources();

	const checkConflicts = useCheckConflicts();
	const { isAdmin } = useIsAdmin();

	// Parse initial rrule if present
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
	const [conflicts, setConflicts] = useState<Occurrence[] | null>(null);
	const [restrictionConflicts, setRestrictionConflicts] = useState<
		{ title: string; start_time: string; end_time: string }[] | null
	>(null);

	const initialResourceIds = useMemo(() => {
		if (defaultValues?.resource_ids && defaultValues.resource_ids.length > 0) {
			return defaultValues.resource_ids;
		}
		if (defaultValues?.occurrences && defaultValues.occurrences.length > 0) {
			return Array.from(
				new Set(defaultValues.occurrences.map((occ) => occ.resource_id)),
			);
		}
		if (defaultValues?.resource_id) {
			return [defaultValues.resource_id];
		}
		return [];
	}, [defaultValues]);

	const form = useForm({
		defaultValues: {
			title: defaultValues?.title ?? "",
			description: defaultValues?.description ?? "",
			status: defaultValues?.status ?? ("confirmed" as ReservationStatus),
			admin_notes: defaultValues?.admin_notes ?? "",
			resource_ids: initialResourceIds,
			start_time: defaultValues?.start_time ?? "",
			end_time: defaultValues?.end_time ?? "",
		},
		onSubmit: async ({ value }) => {
			const until = untilStr ? new Date(untilStr) : null;
			let allOccurrences: CreateOccurrencePayload[] = [];
			let rruleString: string | null = null;

			for (const resourceId of value.resource_ids) {
				const { occurrences, rruleString: generatedRrule } =
					generateOccurrences(value.start_time, value.end_time, resourceId, {
						freq,
						until,
					});
				allOccurrences = [...allOccurrences, ...occurrences];
				if (generatedRrule) rruleString = generatedRrule;
			}

			await onSubmit({
				...value,
				rrule: rruleString,
				occurrences: allOccurrences,
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
			className="space-y-4 max-w-md"
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
				{(field) => {
					const hasError = Boolean(field.state.meta.errors.length);
					return (
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
								isError={hasError}
								placeholder={t("esimViikkokokous", "esim. Viikkokokous")}
							/>
							{hasError && (
								<p className="text-[11px] text-red-500">
									{field.state.meta.errors.join(", ")}
								</p>
							)}
						</div>
					);
				}}
			</form.Field>

			{/* Description */}
			<form.Field name="description">
				{(field) => (
					<div className="space-y-1">
						<label
							htmlFor={field.name}
							className="text-xs font-medium text-stone-700 dark:text-stone-300"
						>
							{t("kuvaus", "Kuvaus")}
						</label>
						<Input
							id={field.name}
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
							placeholder="Lisätiedot..."
						/>
					</div>
				)}
			</form.Field>

			{/* Status (Admin Only) */}
			{isAdmin && (
				<form.Field name="status">
					{(field) => (
						<div className="space-y-1">
							<label
								htmlFor={field.name}
								className="text-xs font-medium text-stone-700 dark:text-stone-300"
							>
								{t("tila", "Tila")}
							</label>
							<select
								id={field.name}
								value={field.state.value}
								onChange={(e) =>
									field.handleChange(e.target.value as ReservationStatus)
								}
								onBlur={field.handleBlur}
								className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
							>
								<option value="confirmed">
									{t("vahvistettu", "Vahvistettu")}
								</option>
								<option value="pending">{t("odottaa", "Odottaa")}</option>
								<option value="cancelled">{t("peruttu", "Peruttu")}</option>
							</select>
						</div>
					)}
				</form.Field>
			)}

			{/* Admin Notes (Admin Only) */}
			{isAdmin && (
				<form.Field name="admin_notes">
					{(field) => (
						<div className="space-y-1">
							<label
								htmlFor={field.name}
								className="text-xs font-medium text-stone-700 dark:text-stone-300"
							>
								{t("yllpitjnMuistiinpanot", "Ylläpitäjän muistiinpanot")}
							</label>
							<Input
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								placeholder={t(
									"vainYllpidolleNkyvtMerkinnt",
									"Vain ylläpidolle näkyvät merkinnät",
								)}
							/>
						</div>
					)}
				</form.Field>
			)}

			{/* Occurrence & Multi-Resource Selection Section */}
			<div className="pt-3 border-t-2 border-stone-800 dark:border-stone-700 space-y-3">
				<h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
					{t("ajanvarausJaResurssit", "Ajanvaraus ja Resurssit")}
				</h3>

				{/* Multi-Resource Selector */}
				<form.Field
					name="resource_ids"
					validators={{
						onChange: ({ value }) =>
							!value || value.length === 0
								? t(
									"valitseVhintnYksiResurssi",
									"Valitse vähintään yksi resurssi",
								)
								: undefined,
					}}
				>
					{(field) => {
						const hasError = Boolean(field.state.meta.errors.length);
						return (
							<div className="space-y-1">
								<span className="text-xs font-medium text-stone-700 dark:text-stone-300">
									{t(
										"resurssitValitseYksiTaiUseampi",
										"Resurssit (Valitse yksi tai useampi)",
									)}
								</span>

								{loadingResources ? (
									<div className="text-xs text-stone-500 py-2">
										{t("ladataanResursseja", "Ladataan resursseja...")}
									</div>
								) : (
									<div className="flex flex-wrap gap-2 p-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md max-h-36 overflow-y-auto">
										{resources?.map((res) => {
											const isChecked = field.state.value.includes(res.id);
											return (
												<button
													key={res.id}
													type="button"
													onClick={() => {
														const nextValue = isChecked
															? field.state.value.filter((id) => id !== res.id)
															: [...field.state.value, res.id];
														field.handleChange(nextValue);
													}}
													className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 ${isChecked
															? "bg-purple-600 text-white border-purple-600 dark:bg-purple-500 dark:border-purple-500"
															: "bg-white dark:bg-stone-800 text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-700"
														}`}
												>
													<span
														className={`w-2 h-2 rounded-full ${isChecked ? "bg-white" : "bg-stone-400"}`}
													/>
													{res.name}
												</button>
											);
										})}
									</div>
								)}
								{hasError && (
									<p className="text-[11px] text-red-500">
										{field.state.meta.errors.join(", ")}
									</p>
								)}
							</div>
						);
					}}
				</form.Field>

				<div className="grid grid-cols-2 gap-2">
					{/* Start Time Field */}
					<form.Field
						name="start_time"
						validators={{
							onChange: ({ value, fieldApi }) => {
								if (!value)
									return t("valitseAlkamisaika", "Alkamisaika on pakollinen.");
								const endTime = fieldApi.form.getFieldValue("end_time");
								if (endTime && new Date(value) >= new Date(endTime)) {
									return t(
										"alkamisaikaJalkeenPaattymisajan",
										"Alkamisajan on oltava ennen päättymisaikaa.",
									);
								}
								return undefined;
							},
						}}
					>
						{(field) => {
							const hasError = Boolean(field.state.meta.errors.length);
							return (
								<div className="space-y-1">
									<label
										htmlFor={field.name}
										className="text-xs font-medium text-stone-700 dark:text-stone-300"
									>
										{t("alkamisaika", "Alkamisaika")}
									</label>
									<Input
										id={field.name}
										type="datetime-local"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										isError={hasError}
									/>
									{hasError && (
										<p className="text-[11px] text-red-500">
											{field.state.meta.errors.join(", ")}
										</p>
									)}
								</div>
							);
						}}
					</form.Field>

					{/* End Time Field */}
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
								const startTime = fieldApi.form.getFieldValue("start_time");
								if (startTime && new Date(value) <= new Date(startTime)) {
									return t(
										"paattymisaikaEnnenAlkamisaikaa",
										"Päättymisajan on oltava alkamisajan jälkeen.",
									);
								}
								return undefined;
							},
						}}
					>
						{(field) => {
							const hasError = Boolean(field.state.meta.errors.length);
							return (
								<div className="space-y-1">
									<label
										htmlFor={field.name}
										className="text-xs font-medium text-stone-700 dark:text-stone-300"
									>
										{t("pttymisaika", "Päättymisaika")}
									</label>
									<Input
										id={field.name}
										type="datetime-local"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										isError={hasError}
									/>
									{hasError && (
										<p className="text-[11px] text-red-500">
											{field.state.meta.errors.join(", ")}
										</p>
									)}
								</div>
							);
						}}
					</form.Field>
				</div>
				{/* Recurrence Rule Fields */}
				<form.Subscribe selector={(state) => [state.values.resource_ids]}>
					{([selectedResourceIds]) => {
						const canRecur =
							isAdmin ||
							(selectedResourceIds.length > 0 &&
								selectedResourceIds.every((id) => {
									const resource = resources?.find((r) => r.id === id);
									return (
										(resource as { allow_recurring?: boolean })
											?.allow_recurring ?? true
									);
								}));

						return (
							<RecurrenceSection
								canRecur={canRecur}
								freq={freq}
								setFreq={setFreq}
								untilStr={untilStr}
								setUntilStr={setUntilStr}
								setConflicts={setConflicts}
							/>
						);
					}}
				</form.Subscribe>

				{/* Automatic Conflict & Restriction Checker */}
				<form.Subscribe
					selector={(state) => [
						state.values.resource_ids,
						state.values.start_time,
						state.values.end_time,
					]}
				>
					{([resourceIds, startTime, endTime]) => (
						<AutomaticConflictChecker
							resourceIds={resourceIds}
							startTime={startTime}
							endTime={endTime}
							freq={freq}
							untilStr={untilStr}
							checkConflicts={checkConflicts}
							conflicts={conflicts}
							setConflicts={setConflicts}
							restrictionConflicts={restrictionConflicts}
							setRestrictionConflicts={setRestrictionConflicts}
							isAdmin={isAdmin}
						/>
					)}
				</form.Subscribe>
			</div>

			{/* Submit Button */}
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, formSubmitting]) => {
					const hasRestrictionViolation =
						!isAdmin &&
						restrictionConflicts !== null &&
						restrictionConflicts.length > 0;

					return (
						<Button
							type="submit"
							disabled={
								!canSubmit ||
								isSubmitting ||
								formSubmitting ||
								hasRestrictionViolation
							}
							className="w-full flex items-center justify-center gap-2 mt-4"
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
					);
				}}
			</form.Subscribe>
		</form>
	);
}

interface AutomaticConflictCheckerProps {
	resourceIds: string[];
	startTime: string;
	endTime: string;
	freq: Frequency | null;
	untilStr: string;
	checkConflicts: ReturnType<typeof useCheckConflicts>;
	conflicts: Occurrence[] | null;
	setConflicts: (conflicts: Occurrence[] | null) => void;
	restrictionConflicts:
	| { title: string; start_time: string; end_time: string }[]
	| null;
	setRestrictionConflicts: (
		items: { title: string; start_time: string; end_time: string }[] | null,
	) => void;
	isAdmin: boolean;
}

function AutomaticConflictChecker({
	resourceIds,
	startTime,
	endTime,
	freq,
	untilStr,
	checkConflicts,
	conflicts,
	setConflicts,
	restrictionConflicts,
	setRestrictionConflicts,
	isAdmin,
}: AutomaticConflictCheckerProps) {
	const { t } = useTranslation();
	const mutateAsync = checkConflicts.mutateAsync;

	// Query restrictions active around the selected dates
	const { data: activeRestrictions } = useRestrictions({
		start_date: startTime ? new Date(startTime).toISOString() : undefined,
		end_date: untilStr
			? new Date(untilStr).toISOString()
			: endTime
				? new Date(endTime).toISOString()
				: undefined,
	});

	useEffect(() => {
		if (!resourceIds || resourceIds.length === 0 || !startTime || !endTime) {
			setConflicts(null);
			setRestrictionConflicts(null);
			return;
		}

		const until = untilStr ? new Date(untilStr) : null;
		let allOccurrences: CreateOccurrencePayload[] = [];
		for (const resourceId of resourceIds) {
			const { occurrences } = generateOccurrences(
				startTime,
				endTime,
				resourceId,
				{ freq, until },
			);
			allOccurrences = [...allOccurrences, ...occurrences];
		}

		if (allOccurrences.length === 0) {
			setConflicts(null);
			setRestrictionConflicts(null);
			return;
		}

		// Check for overlapping restrictions (unless admin)
		if (!isAdmin && activeRestrictions && activeRestrictions.length > 0) {
			const foundRestrictions: {
				title: string;
				start_time: string;
				end_time: string;
			}[] = [];

			for (const proposed of allOccurrences) {
				const pStart = new Date(proposed.start_time).getTime();
				const pEnd = new Date(proposed.end_time).toISOString();
				const pEndMs = new Date(proposed.end_time).getTime();

				for (const restr of activeRestrictions) {
					for (const rOcc of restr.occurrences || []) {
						// Check resource scoping (NULL = global, or matching resourceId)
						if (
							!rOcc.resource_id ||
							rOcc.resource_id === proposed.resource_id
						) {
							const rStartMs = new Date(rOcc.start_time).getTime();
							const rEndMs = new Date(rOcc.end_time).getTime();

							if (pStart < rEndMs && pEndMs > rStartMs) {
								foundRestrictions.push({
									title: restr.title,
									start_time: proposed.start_time,
									end_time: pEnd,
								});
							}
						}
					}
				}
			}

			setRestrictionConflicts(
				foundRestrictions.length > 0 ? foundRestrictions : [],
			);
		} else {
			setRestrictionConflicts(null);
		}

		// Check for overlapping reservations
		let isCancelled = false;
		mutateAsync(allOccurrences)
			.then((results) => {
				if (!isCancelled) setConflicts(results);
			})
			.catch(() => {
				if (!isCancelled) setConflicts(null);
			});

		return () => {
			isCancelled = true;
		};
	}, [
		resourceIds,
		startTime,
		endTime,
		freq,
		untilStr,
		activeRestrictions,
		isAdmin,
		mutateAsync,
		setConflicts,
		setRestrictionConflicts,
	]);

	if (checkConflicts.isPending) {
		return (
			<div className="flex items-center justify-center py-2 text-xs font-mono text-stone-500 gap-2">
				<Loader2 className="animate-spin" size={14} />
				<span>
					{t("tarkistetaanPllekkisyyksi", "Tarkistetaan päällekkäisyyksiä...")}
				</span>
			</div>
		);
	}

	const hasReservationConflicts = conflicts !== null && conflicts.length > 0;
	const hasRestrictionViolations =
		!isAdmin &&
		restrictionConflicts !== null &&
		restrictionConflicts.length > 0;

	if (
		!hasReservationConflicts &&
		!hasRestrictionViolations &&
		conflicts !== null
	) {
		return (
			<div className="p-2 bg-emerald-100 dark:bg-emerald-950/80 border-2 border-emerald-600 text-emerald-900 dark:text-emerald-200 rounded-sm flex items-center gap-2 text-xs font-medium">
				<CheckCircle2 size={16} />
				<span>{t("eiPllekkisiVarauksia", "Ei päällekkäisiä varauksia.")}</span>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{/* Restriction Violations */}
			{hasRestrictionViolations && (
				<div className="p-3 bg-amber-100 dark:bg-amber-950/80 border-2 border-amber-600 text-amber-900 dark:text-amber-200 rounded-sm space-y-2 text-xs">
					<div className="flex items-center gap-2 font-bold">
						<ShieldAlert size={16} className="text-amber-600 shrink-0" />
						<span>
							{t(
								"varausOsuuRajoitetulleAjalle",
								"Varaus osuu rajoitetulle ajanjaksolle! ({{length}})",
								{ length: restrictionConflicts.length },
							)}
						</span>
					</div>
					<ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
						{restrictionConflicts.map((item, idx) => (
							<li key={`restr-conf-${idx}`}>
								<span className="font-semibold font-sans">{item.title}:</span>{" "}
								{formatDate(item.start_time)} – {formatDate(item.end_time)}
							</li>
						))}
					</ul>
				</div>
			)}

			{/* Reservation Conflicts */}
			{hasReservationConflicts && (
				<div className="p-3 bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-600 text-rose-900 dark:text-rose-200 rounded-sm space-y-2 text-xs">
					<div className="flex items-center gap-2 font-bold">
						<AlertTriangle size={16} />
						<span>
							{t(
								"lytyiLengthPllekkistVarausta",
								"Löytyi {{length}} päällekkäistä varausta!",
								{ length: conflicts.length },
							)}
						</span>
					</div>
					<ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
						{conflicts.map((occ) => (
							<li key={occ.id}>
								{formatDate(occ.start_time)} – {formatDate(occ.end_time)}
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}

interface RecurrenceSectionProps {
	canRecur: boolean;
	freq: Frequency | null;
	setFreq: (freq: Frequency | null) => void;
	untilStr: string;
	setUntilStr: (str: string) => void;
	setConflicts: (conflicts: Occurrence[] | null) => void;
}

function RecurrenceSection({
	canRecur,
	freq,
	setFreq,
	untilStr,
	setUntilStr,
	setConflicts,
}: RecurrenceSectionProps) {
	const { t } = useTranslation();
	useEffect(() => {
		if (!canRecur && freq !== null) {
			setFreq(null);
			setConflicts(null);
		}
	}, [canRecur, freq, setFreq, setConflicts]);

	if (!canRecur) {
		return null;
	}

	return (
		<div className="p-3 bg-stone-100 dark:bg-stone-900 border-2 border-stone-800 dark:border-stone-700 rounded-sm space-y-2">
			<div className="flex items-center justify-between text-xs font-mono font-bold text-stone-800 dark:text-stone-200">
				<div className="flex items-center gap-1.5">
					<RefreshCw size={14} />
					<span>{t("toistuvuus", "Toistuvuus")}</span>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-2">
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
						className="w-full px-2 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-sm"
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
							onChange={(e) => {
								setUntilStr(e.target.value);
							}}
						/>
					</div>
				)}
			</div>
		</div>
	);
}
