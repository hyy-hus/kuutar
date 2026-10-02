import { useForm, useSelector } from "@tanstack/react-form";
import {
	AlertTriangle,
	CheckCircle2,
	FileText,
	Loader2,
	RefreshCw,
	Save,
	ShieldAlert,
	UserCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Frequency } from "rrule";
import { Button } from "#/components/Button";
import { Input } from "#/components/Input";
import { useIsAdmin } from "#/hooks/useAuth";
import {
	type Contract,
	getApplicableContracts,
	getLocalizedText,
	getStaticContractUrl,
	useContracts,
} from "#/hooks/useContracts";
import {
	type CreateOccurrencePayload,
	type Occurrence,
	type ReservationStatus,
	useCheckConflicts,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useRestrictions } from "#/hooks/useRestrictions";
import {
	formatDateTimeLocal,
	formatYYYYMMDD,
	localDayRangeISO,
	parseLocalDate,
	useDateFormatter,
} from "#/utils/date";
import { generateOccurrences, parseRRule } from "#/utils/rruleUtils";

export interface ReservationFormValues {
	title: string;
	description?: string;
	status?: ReservationStatus;
	admin_notes?: string;
	contact_person?: string;
	contact_email?: string;
	contact_phone?: string;
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
	/** Set when editing, so the reservation is not reported as conflicting with itself */
	reservationId?: string;
}

export function ReservationForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	reservationId,
}: ReservationFormProps) {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const { data: resources, isLoading: loadingResources } = useResources();
	const { data: activeContracts, isLoading: loadingContracts } = useContracts({
		active_only: true,
	});

	const checkConflicts = useCheckConflicts();
	const { isAdmin } = useIsAdmin();

	const initialRule = parseRRule(defaultValues?.rrule);

	const [freq, setFreq] = useState<Frequency | null>(initialRule.freq);
	const [untilStr, setUntilStr] = useState<string>(
		initialRule.until ? formatYYYYMMDD(initialRule.until) : "",
	);
	const [conflicts, setConflicts] = useState<Occurrence[] | null>(null);
	const [restrictionConflicts, setRestrictionConflicts] = useState<
		{ title: string; start_time: string; end_time: string }[] | null
	>(null);

	const [contractsApproved, setContractsApproved] = useState(false);

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
			contact_person: defaultValues?.contact_person ?? "",
			contact_email: defaultValues?.contact_email ?? "",
			contact_phone: defaultValues?.contact_phone ?? "",
			resource_ids: initialResourceIds,
			start_time: defaultValues?.start_time ?? "",
			end_time: defaultValues?.end_time ?? "",
		},
		onSubmit: async ({ value }) => {
			const until = untilStr ? parseLocalDate(untilStr) : null;
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
				title: value.title,
				description: value.description,
				status: value.status,
				admin_notes: value.admin_notes || undefined,
				contact_person: value.contact_person || undefined,
				contact_email: value.contact_email || undefined,
				contact_phone: value.contact_phone || undefined,
				resource_ids: value.resource_ids,
				start_time: value.start_time,
				end_time: value.end_time,
				rrule: rruleString,
				occurrences: allOccurrences,
			});
		},
	});

	const selectedResourceIds = useSelector(
		form.store,
		(state) => state.values.resource_ids,
	);
	const applicableContracts = useMemo(
		() => getApplicableContracts(activeContracts, selectedResourceIds),
		[activeContracts, selectedResourceIds],
	);
	const needsContractApproval =
		!isAdmin && applicableContracts.length > 0 && !contractsApproved;

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
							placeholder={t("lisatiedot", "Lisätiedot...")}
						/>
					</div>
				)}
			</form.Field>

			{/* Contact Details */}
			<div className="space-y-4">
				<div className="p-3 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md space-y-3">
					<div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
						<UserCheck size={14} />
						<span>{t("yhteystiedot", "Yhteystiedot")}</span>
					</div>

					<div className="space-y-2">
						<form.Field
							name="contact_person"
							validators={{
								onChange: ({ value }) =>
									!isAdmin && !value.trim()
										? t(
												"yhteyshenkiloOnPakollinen",
												"Yhteyshenkilö on pakollinen",
											)
										: undefined,
							}}
						>
							{(field) => (
								<div className="space-y-0.5">
									<label
										htmlFor={field.name}
										className="text-[11px] text-stone-600 dark:text-stone-400"
									>
										{t("yhteyshenkilo", "Yhteyshenkilö")}
									</label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder={t("yhteyshenkilonNimi", "Yhteyshenkilön nimi")}
										isError={Boolean(field.state.meta.errors.length)}
										onBlur={field.handleBlur}
									/>
									{Boolean(field.state.meta.errors.length) && (
										<p className="text-[11px] text-red-500">
											{field.state.meta.errors.join(", ")}
										</p>
									)}
								</div>
							)}
						</form.Field>

						<div className="grid grid-cols-2 gap-2">
							<form.Field
								name="contact_email"
								validators={{
									onChange: ({ value }) =>
										!isAdmin && !value.trim()
											? t(
													"yhteysSahkopostiOnPakollinen",
													"Sähköposti on pakollinen",
												)
											: undefined,
								}}
							>
								{(field) => (
									<div className="space-y-0.5">
										<label
											htmlFor={field.name}
											className="text-[11px] text-stone-600 dark:text-stone-400"
										>
											{t("yhteysSähköposti", "Sähköposti")}
										</label>
										<Input
											id={field.name}
											type="email"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder={t(
												"esimYhteysSahkoposti",
												"yhteys@esimerkki.fi",
											)}
											isError={Boolean(field.state.meta.errors.length)}
											onBlur={field.handleBlur}
										/>
										{Boolean(field.state.meta.errors.length) && (
											<p className="text-[11px] text-red-500">
												{field.state.meta.errors.join(", ")}
											</p>
										)}
									</div>
								)}
							</form.Field>

							<form.Field
								name="contact_phone"
								validators={{
									onChange: ({ value }) =>
										!isAdmin && !value.trim()
											? t(
													"puhelinnumeroOnPakollinen",
													"Puhelinnumero on pakollinen",
												)
											: undefined,
								}}
							>
								{(field) => (
									<div className="space-y-0.5">
										<label
											htmlFor={field.name}
											className="text-[11px] text-stone-600 dark:text-stone-400"
										>
											{t("puhelinnumero", "Puhelinnumero")}
										</label>
										<Input
											id={field.name}
											type="tel"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="+358..."
											isError={Boolean(field.state.meta.errors.length)}
											onBlur={field.handleBlur}
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
					</div>
				</div>

				{isAdmin && (
					<div className="p-3 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md space-y-3">
						<div className="flex items-center gap-1.5 text-xs font-bold text-purple-700 dark:text-purple-400">
							<ShieldAlert size={14} />
							<span>{t("vainYllapidolle", "Vain ylläpidolle")}</span>
						</div>

						<div className="space-y-2">
							<form.Field name="admin_notes">
								{(field) => (
									<div className="space-y-0.5">
										<label
											htmlFor={field.name}
											className="text-[11px] text-stone-600 dark:text-stone-400"
										>
											{t("yllpitjnMuistiinpanot", "Ylläpitäjän muistiinpanot")}
										</label>
										<Input
											id={field.name}
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder={t(
												"vainYllpidolleNkyvtMerkinnt",
												"Vain ylläpidolle näkyvät merkinnät",
											)}
										/>
									</div>
								)}
							</form.Field>

							<form.Field name="status">
								{(field) => (
									<div className="space-y-0.5">
										<label
											htmlFor={field.name}
											className="text-[11px] text-stone-600 dark:text-stone-400"
										>
											{t("tila", "Tila")}
										</label>
										<select
											id={field.name}
											value={field.state.value}
											onChange={(e) =>
												field.handleChange(e.target.value as ReservationStatus)
											}
											className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
										>
											<option value="confirmed">
												{t("vahvistettu", "Vahvistettu")}
											</option>
											<option value="pending">{t("odottaa", "Odottaa")}</option>
											<option value="cancelled">
												{t("peruttu", "Peruttu")}
											</option>
										</select>
									</div>
								)}
							</form.Field>
						</div>
					</div>
				)}
			</div>

			{/* Occurrence & Multi-Resource Selection Section */}
			<div className="pt-3 border-t-2 border-stone-800 dark:border-stone-700 space-y-3">
				<h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
					{t("ajanvarausJaResurssit", "Ajanvaraus ja Resurssit")}
				</h3>

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
														setContractsApproved(false);
													}}
													className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors flex items-center gap-1.5 ${
														isChecked
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
										onChange={(e) => {
											const nextStart = e.target.value;
											const prevStart = new Date(field.state.value);
											const prevEnd = new Date(
												field.form.getFieldValue("end_time"),
											);
											const duration = prevEnd.getTime() - prevStart.getTime();

											// Keep the previous duration when the new start passes the end.
											// End is updated first so the start validator sees the new end.
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

					<form.Field
						name="end_time"
						validators={{
							onChangeListenTo: ["start_time", "resource_ids"],
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

								const selectedResourceIds =
									fieldApi.form.getFieldValue("resource_ids") || [];
								for (const rId of selectedResourceIds) {
									const res = resources?.find((r) => r.id === rId);
									if (res?.reservable_until) {
										const limit = new Date(res.reservable_until).getTime();
										if (new Date(value).getTime() > limit) {
											return t(
												"resurssiEiVarattavissaAsti",
												"Resurssia '{{name}}' voi varata vain päivämäärään {{date}} asti.",
												{
													name: res.name,
													date: formatDate(res.reservable_until),
												},
											);
										}
									}
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
				<form.Subscribe selector={(state) => state.values.resource_ids}>
					{(selectedResourceIds) => {
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

				{/* Automatic Conflict Checker */}
				<form.Subscribe
					selector={(state) =>
						[
							state.values.resource_ids,
							state.values.start_time,
							state.values.end_time,
						] as const
					}
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
							reservationId={reservationId}
						/>
					)}
				</form.Subscribe>
			</div>

			{/* Contract Approval Section */}
			{!isAdmin && (
				<ContractApprovalSection
					contracts={applicableContracts}
					isLoading={loadingContracts}
					approved={contractsApproved}
					onApproveChange={setContractsApproved}
				/>
			)}

			{/* Submit Button */}
			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting] as const}
			>
				{([canSubmit, formSubmitting]) => {
					const hasRestrictionViolation =
						!isAdmin &&
						restrictionConflicts !== null &&
						restrictionConflicts.length > 0;

					const hasReservationConflict =
						!isAdmin && conflicts !== null && conflicts.length > 0;

					return (
						<Button
							type="submit"
							disabled={
								!canSubmit ||
								isSubmitting ||
								formSubmitting ||
								hasRestrictionViolation ||
								hasReservationConflict ||
								needsContractApproval
							}
							className="w-full flex items-center justify-center gap-2 mt-4"
						>
							{isSubmitting || formSubmitting ? (
								<Loader2 className="animate-spin" size={16} />
							) : (
								<>
									<Save size={16} />
									<span>{submitLabel ?? t("tallenna", "Tallenna")}</span>
								</>
							)}
						</Button>
					);
				}}
			</form.Subscribe>
		</form>
	);
}

interface ContractApprovalSectionProps {
	/** Contracts that apply to the selected resources */
	contracts: Contract[];
	isLoading: boolean;
	approved: boolean;
	onApproveChange: (approved: boolean) => void;
}

function ContractApprovalSection({
	contracts,
	isLoading,
	approved,
	onApproveChange,
}: ContractApprovalSectionProps) {
	const { t, i18n } = useTranslation();
	const currentLocale = i18n.language || "fi";

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-xs text-stone-500 py-2">
				<Loader2 className="animate-spin" size={14} />
				<span>{t("ladataanSopimusehtoja", "Ladataan sopimusehtoja...")}</span>
			</div>
		);
	}

	if (contracts.length === 0) {
		return null;
	}

	return (
		<div className="p-3 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md space-y-2">
			<div className="flex items-center gap-1.5 text-xs font-bold text-stone-900 dark:text-stone-100">
				<FileText size={15} className="text-purple-600 dark:text-purple-400" />
				<span>{t("sopimuksetJaEhot", "Sopimukset ja ehdot")}</span>
			</div>

			<p className="text-[11px] text-stone-600 dark:text-stone-400">
				{t(
					"tutustuJaHyvksySeuraavatEhot",
					"Tutustu ja hyväksy seuraavat varaukseen liittyvät ehdot ennen lähettämistä:",
				)}
			</p>

			<ul className="space-y-1">
				{contracts.map((contract) => {
					const hrefUrl = getStaticContractUrl(contract.s3_key, currentLocale);

					return (
						<li
							key={contract.id}
							className="flex items-center justify-between p-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded text-xs"
						>
							<span className="font-medium text-stone-800 dark:text-stone-200 truncate max-w-[200px]">
								{getLocalizedText(contract.title, currentLocale)}
							</span>
							<a
								href={hrefUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[11px] font-semibold text-purple-600 hover:text-purple-700 dark:text-purple-400 hover:underline"
							>
								{t("lataaTaiLue", "Lue ehdot")}
								{" →"}
							</a>
						</li>
					);
				})}
			</ul>

			<label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
				<input
					type="checkbox"
					checked={approved}
					onChange={(e) => onApproveChange(e.target.checked)}
					className="mt-0.5 h-4 w-4 rounded border-stone-300 text-purple-600 focus:ring-purple-500"
				/>
				<span className="text-xs font-medium text-stone-800 dark:text-stone-200 leading-tight">
					{t(
						"hyvksynSopimusehdot",
						"Olen lukenut ja hyväksyn sovellettavat sopimusehdot.",
					)}
				</span>
			</label>
		</div>
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
	reservationId?: string;
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
	reservationId,
}: AutomaticConflictCheckerProps) {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const mutateAsync = checkConflicts.mutateAsync;

	const { data: activeRestrictions } = useRestrictions({
		start_date: startTime ? new Date(startTime).toISOString() : undefined,
		// Through the end of the last day of the series
		end_date: untilStr
			? localDayRangeISO(parseLocalDate(untilStr), parseLocalDate(untilStr))
					.endISO
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

		const until = untilStr ? parseLocalDate(untilStr) : null;
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
						if (
							!rOcc.resource_id ||
							rOcc.resource_id === proposed.resource_id
						) {
							const rStartMs = new Date(rOcc.start_time).getTime();
							const rEndMs = new Date(rOcc.end_time).getTime();

							// The same restriction can overlap once per selected resource;
							// list each title/time pair only once
							const isDuplicate = foundRestrictions.some(
								(f) =>
									f.title === restr.title &&
									f.start_time === proposed.start_time &&
									f.end_time === pEnd,
							);
							if (pStart < rEndMs && pEndMs > rStartMs && !isDuplicate) {
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

		let isCancelled = false;
		mutateAsync({
			occurrences: allOccurrences,
			excludeReservationId: reservationId,
		})
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
		reservationId,
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
						{restrictionConflicts.map((item) => (
							<li key={`${item.title}-${item.start_time}-${item.end_time}`}>
								<span className="font-semibold font-sans">
									{item.title}
									{":"}
								</span>{" "}
								{formatDate(item.start_time)}
								{" – "}
								{formatDate(item.end_time)}
							</li>
						))}
					</ul>
				</div>
			)}

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
								{formatDate(occ.start_time)}
								{" – "}
								{formatDate(occ.end_time)}
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
