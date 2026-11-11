import { useForm, useSelector } from "@tanstack/react-form";
import {
	CalendarCheck,
	FileText,
	Loader2,
	RefreshCw,
	Save,
	ShieldAlert,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DateTimeInput } from "#/components/DateTimeInput";
import { FormSection } from "#/components/FormSection";
import { FormSummaryCard } from "#/components/FormSummaryCard";
import { GuidedFormLayout } from "#/components/GuidedFormLayout";
import { Input } from "#/components/Input";
import { LocalizedRichTextEditor } from "#/components/LocalizedRichTextEditor";
import { RecurrenceFields } from "#/components/RecurrenceFields";
import { ResourceInfoDialog } from "#/components/ResourceInfoDialog";
import { ResourcePicker } from "#/components/ResourcePicker";
import { Select } from "#/components/Select";
import { StickyFormActions } from "#/components/StickyFormActions";
import { Textarea } from "#/components/Textarea";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { useCollections } from "#/hooks/useCollections";
import {
	type Contract,
	getApplicableContracts,
	getLocalizedText,
	getStaticContractUrl,
	useContracts,
} from "#/hooks/useContracts";
import { useReservableBlocks } from "#/hooks/useReservableBlocks";
import {
	type CreateOccurrencePayload,
	type Occurrence,
	type ReservationStatus,
	useCheckConflicts,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useRestrictions } from "#/hooks/useRestrictions";
import { useUsers } from "#/hooks/useUsers";
import {
	addDays,
	formatDateTimeLocal,
	localDayRangeISO,
	useDateFormatter,
} from "#/utils/date";
import {
	addMinutes,
	checkDuration,
	formatMinutes,
	resolveDefaultDuration,
} from "#/utils/duration";
import { findRestrictionConflicts } from "#/utils/restrictionConflicts";
import {
	compactLocalizedRichText,
	type LocalizedRichText,
} from "#/utils/richText";
import {
	generateOccurrences,
	listSeriesStarts,
	NO_RECURRENCE,
	parseRRule,
	type RRuleConfig,
} from "#/utils/rruleUtils";

/** Red asterisk after a label of a required field (the input carries `aria-required`) */
function RequiredMark() {
	return (
		<span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">
			{"*"}
		</span>
	);
}

/** How far ahead a user can browse reservable blocks in the form */
const BLOCK_LOOKAHEAD_DAYS = 90;

export interface ReservationFormValues {
	/** Admins only: the user the reservation is made for; empty means the admin themselves */
	user_id?: string;
	title: string;
	/** Public, localized rich text */
	description?: LocalizedRichText;
	/** Private note from the reserver to the admins */
	message_to_admins?: string;
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
	/** Shows a "Peruuta" button next to submit */
	onCancel?: () => void;
	/** Set when editing, so the reservation is not reported as conflicting with itself */
	reservationId?: string;
}

export function ReservationForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	isCreate = false,
	onCancel,
	reservationId,
}: ReservationFormProps) {
	const { t } = useTranslation();
	const { formatDate, formatRange } = useDateFormatter();
	const { data: resources, isLoading: loadingResources } = useResources();
	const { data: collections } = useCollections();
	const { data: activeContracts, isLoading: loadingContracts } = useContracts({
		active_only: true,
	});

	const checkConflicts = useCheckConflicts();
	const { isAdmin } = useIsAdmin();
	const { user: currentUser } = useAuth();
	const { data: users } = useUsers({ enabled: isAdmin && isCreate });

	const [recurrence, setRecurrence] = useState<RRuleConfig>(() => {
		const { dtstart: _dtstart, ...config } = parseRRule(defaultValues?.rrule);
		return config;
	});
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
			user_id: defaultValues?.user_id ?? "",
			title: defaultValues?.title ?? "",
			description: defaultValues?.description ?? ({} as LocalizedRichText),
			message_to_admins: defaultValues?.message_to_admins ?? "",
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
			let allOccurrences: CreateOccurrencePayload[] = [];
			let rruleString: string | null = null;

			for (const resourceId of value.resource_ids) {
				const { occurrences, rruleString: generatedRrule } =
					generateOccurrences(
						value.start_time,
						value.end_time,
						resourceId,
						recurrence,
					);
				allOccurrences = [...allOccurrences, ...occurrences];
				if (generatedRrule) rruleString = generatedRrule;
			}

			await onSubmit({
				user_id: value.user_id || undefined,
				title: value.title,
				description: compactLocalizedRichText(value.description) ?? {},
				message_to_admins: value.message_to_admins.trim(),
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
	const startTime = useSelector(form.store, (state) => state.values.start_time);
	const endTime = useSelector(form.store, (state) => state.values.end_time);

	// Resources that can only be reserved in blocks: users pick a block, admins may go outside
	const blocksOnlyResourceId = selectedResourceIds.find(
		(id) => resources?.find((r) => r.id === id)?.blocks_only,
	);
	const blocksOnlyMode = !isAdmin && blocksOnlyResourceId !== undefined;

	/** Resources the user may pick: those they can reserve, plus any already on the reservation */
	const selectableResources = (selectedIds: string[]) =>
		(resources ?? []).filter(
			(r) => r.can_reserve || selectedIds.includes(r.id),
		);

	// A new reservation must not start with resources the user can't reserve
	// (e.g. prefilled from the URL or a calendar link) or keep ones they lost access to.
	// Resources missing from the list count too: they could no longer be unticked
	useEffect(() => {
		if (!isCreate || !resources) return;
		const current = form.getFieldValue("resource_ids");
		const allowed = current.filter(
			(id) => resources.find((r) => r.id === id)?.can_reserve === true,
		);
		if (allowed.length !== current.length) {
			form.setFieldValue("resource_ids", allowed);
		}
	}, [isCreate, resources, form]);

	// Reaches past the default lookahead when a block further ahead was preselected
	// (e.g. from the calendar), so it can still be found and shown as selected
	const blockRange = useMemo(() => {
		const today = new Date();
		const lookaheadEnd = addDays(today, BLOCK_LOOKAHEAD_DAYS);
		const selectedEnd = endTime ? addDays(new Date(endTime), 1) : lookaheadEnd;
		return localDayRangeISO(
			today,
			selectedEnd > lookaheadEnd ? selectedEnd : lookaheadEnd,
		);
	}, [endTime]);
	const { data: blocks, isLoading: loadingBlocks } = useReservableBlocks(
		{
			start_date: blockRange.startISO,
			end_date: blockRange.endISO,
			resource_id: blocksOnlyResourceId,
		},
		{ enabled: blocksOnlyResourceId !== undefined },
	);

	const blockOptions = useMemo(() => {
		const startMs = startTime ? new Date(startTime).getTime() : Number.NaN;
		const endMs = endTime ? new Date(endTime).getTime() : Number.NaN;
		return (blocks ?? [])
			.flatMap((block) =>
				block.occurrences.map((occ) => ({
					id: occ.id,
					title: block.title,
					start: new Date(occ.start_time),
					end: new Date(occ.end_time),
					reserved: occ.reserved,
				})),
			)
			.map((opt) => ({
				...opt,
				selected:
					opt.start.getTime() === startMs && opt.end.getTime() === endMs,
			}))
			.filter((opt) => !opt.reserved || opt.selected)
			.filter((opt) => {
				// Mirror the server's reservable_until limit for non-admins
				const limit = resources?.find(
					(r) => r.id === blocksOnlyResourceId,
				)?.reservable_until;
				return !limit || opt.end.getTime() <= new Date(limit).getTime();
			});
	}, [blocks, startTime, endTime, resources, blocksOnlyResourceId]);

	const hasSelectedBlock = blockOptions.some((opt) => opt.selected);
	const adminOutsideBlocks =
		isAdmin &&
		blocksOnlyResourceId !== undefined &&
		Boolean(startTime && endTime) &&
		!loadingBlocks &&
		!(blocks ?? []).some((block) =>
			block.occurrences.some(
				(occ) =>
					new Date(occ.start_time).getTime() ===
						new Date(startTime).getTime() &&
					new Date(occ.end_time).getTime() === new Date(endTime).getTime(),
			),
		);

	const applicableContracts = useMemo(
		() => getApplicableContracts(activeContracts, selectedResourceIds),
		[activeContracts, selectedResourceIds],
	);
	const needsContractApproval =
		!isAdmin && applicableContracts.length > 0 && !contractsApproved;

	// What the form is about to save, for the summary card and the sticky action bar
	const selectedResourceNames = (resources ?? [])
		.filter((r) => selectedResourceIds.includes(r.id))
		.map((r) => r.name);
	const seriesCount = useMemo(
		() =>
			recurrence.freq === "none" || !startTime
				? 1
				: Math.max(
						listSeriesStarts(startTime, recurrence).length -
							recurrence.exdates.length,
						0,
					),
		[recurrence, startTime],
	);
	const timeSummary =
		startTime && endTime ? formatRange(startTime, endTime) : "";
	const selectedResources = (resources ?? []).filter((r) =>
		selectedResourceIds.includes(r.id),
	);
	// Admins choose the status themselves, so only reservers get a prediction
	// Mirrors the server's should_auto_confirm for the current user's group
	const confirmsImmediately =
		selectedResources.length > 0 &&
		selectedResources.every(
			(r) =>
				r.auto_confirm &&
				(r.auto_confirm_group_ids.length === 0 ||
					(currentUser?.group_id !== undefined &&
						r.auto_confirm_group_ids.includes(currentUser.group_id))),
		);
	const outcome =
		isAdmin || selectedResources.length === 0
			? null
			: confirmsImmediately
				? t("yhteenvetoVahvistuuHeti", "Vahvistuu heti")
				: t("yhteenvetoOdottaaHyvaksyntaa", "Ylläpito hyväksyy varauksen");
	const summaryLine = [
		selectedResourceNames.join(", "),
		timeSummary,
		seriesCount > 1
			? t("toistoKertaa", "{{count}} kertaa", { count: seriesCount })
			: "",
	]
		.filter(Boolean)
		.join(" · ");

	const sectionIndex = [
		{
			id: "reservation-time",
			label: t("osioMitaJaMilloin", "Mitä ja milloin"),
		},
		{
			id: "reservation-info",
			label: t("varauksenTiedotOsio", "Varauksen tiedot"),
		},
		{
			id: "reservation-contact",
			label: t("osioYhteystiedotJaViestit", "Yhteystiedot ja viestit"),
		},
		...(isAdmin
			? [
					{
						id: "reservation-admin",
						label: t("vainYllapidolle", "Vain ylläpidolle"),
					},
				]
			: []),
	];

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
		>
			<GuidedFormLayout
				index={sectionIndex}
				indexLabel={t("lomakkeenOsiot", "Lomakkeen osiot")}
				summary={
					<FormSummaryCard
						title={t("yhteenveto", "Yhteenveto")}
						items={[
							{
								label: t("resurssit", "Resurssit"),
								value: selectedResourceNames.length
									? selectedResourceNames.join(", ")
									: "–",
							},
							{ label: t("aika", "Aika"), value: timeSummary || "–" },
							{
								label: t("toistuvuus", "Toistuvuus"),
								value:
									seriesCount > 1
										? t("toistoKertaa", "{{count}} kertaa", {
												count: seriesCount,
											})
										: t("eiToistoa", "Ei toistoa"),
							},
						]}
						footer={outcome ?? undefined}
					/>
				}
			>
				{/* Occurrence & Multi-Resource Selection Section */}
				<FormSection
					id="reservation-time"
					step={1}
					title={t("osioMitaJaMilloin", "Mitä ja milloin")}
				>
					{/* Owner (admins can reserve on behalf of another user) */}
					{isAdmin && isCreate && (
						<form.Field name="user_id">
							{(field) => (
								<div className="space-y-1">
									<label
										htmlFor={field.name}
										className="text-sm font-medium text-stone-900 dark:text-stone-100"
									>
										{t("varauksenKayttaja", "Varaus käyttäjälle")}
									</label>
									<Select
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
									>
										<option value="">{t("minaItse", "Minä itse")}</option>
										{users
											?.filter((u) => u.id !== currentUser?.id)
											.map((u) => (
												<option key={u.id} value={u.id}>
													{u.name ? `${u.name} (${u.email})` : u.email}
												</option>
											))}
									</Select>
									<p className="text-xs text-stone-600 dark:text-stone-400">
										{t(
											"varauksenKayttajaKuvaus",
											"Varaus näkyy valitun käyttäjän varauksena, ja sähköpostiviestit lähetetään hänelle.",
										)}
									</p>
								</div>
							)}
						</form.Field>
					)}

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
									<span className="block text-sm font-medium text-stone-900 dark:text-stone-100">
										{t(
											"resurssitValitseYksiTaiUseampi",
											"Resurssit (Valitse yksi tai useampi)",
										)}
										<RequiredMark />
									</span>

									{loadingResources ? (
										<div className="text-xs text-stone-500 py-2">
											{t("ladataanResursseja", "Ladataan resursseja...")}
										</div>
									) : (
										<>
											{selectableResources(field.state.value).length === 0 && (
												<p className="text-xs text-stone-600 dark:text-stone-400">
													{t(
														"eiVarattavissaOlevia",
														"Ryhmälläsi ei ole oikeutta varata yhtään resurssia.",
													)}
												</p>
											)}
											<ResourcePicker
												resources={selectableResources(field.state.value)}
												collections={collections ?? []}
												value={field.state.value}
												onToggle={(id) => {
													const res = resources?.find((r) => r.id === id);
													if (!res) return;
													const isChecked = field.state.value.includes(res.id);
													// A blocks-only resource has its own block times, so for
													// non-admins it can't be combined with other resources
													const exclusive =
														!isAdmin &&
														(res.blocks_only ||
															field.state.value.some(
																(id) =>
																	resources?.find((r) => r.id === id)
																		?.blocks_only,
															));
													const nextValue = isChecked
														? field.state.value.filter((id) => id !== res.id)
														: exclusive
															? [res.id]
															: [...field.state.value, res.id];
													field.handleChange(nextValue);
													setContractsApproved(false);
													// Pre-fill the end time from the resources' default duration
													// until the user has set one themselves
													const start = form.getFieldValue("start_time");
													const defaultMinutes = resolveDefaultDuration(
														(resources ?? []).filter((r) =>
															nextValue.includes(r.id),
														),
													);
													if (
														isCreate &&
														start &&
														defaultMinutes &&
														!form.getFieldMeta("end_time")?.isTouched
													) {
														form.setFieldValue(
															"end_time",
															addMinutes(start, defaultMinutes),
														);
													}
												}}
											/>
										</>
									)}
									{field.state.value.length > 0 && (
										<ResourceInfoDialog
											resources={(resources ?? []).filter((r) =>
												field.state.value.includes(r.id),
											)}
										/>
									)}
									{hasError && (
										<p className="text-xs text-red-600 dark:text-red-400">
											{field.state.meta.errors.join(", ")}
										</p>
									)}
								</div>
							);
						}}
					</form.Field>

					{blocksOnlyMode ? (
						<BlockPicker
							options={blockOptions}
							isLoading={loadingBlocks}
							onSelect={(opt) => {
								form.setFieldValue(
									"start_time",
									formatDateTimeLocal(opt.start),
								);
								form.setFieldValue("end_time", formatDateTimeLocal(opt.end));
							}}
						/>
					) : (
						<>
							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
								<form.Field
									name="start_time"
									validators={{
										onChange: ({ value, fieldApi }) => {
											if (!value)
												return t(
													"valitseAlkamisaika",
													"Alkamisaika on pakollinen.",
												);
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
													className="text-sm font-medium text-stone-900 dark:text-stone-100"
												>
													{t("alkamisaika", "Alkamisaika")}
													<RequiredMark />
												</label>
												<DateTimeInput
													id={field.name}
													aria-required="true"
													value={field.state.value}
													onChange={(e) => {
														const nextStart = e.target.value;
														const prevStart = new Date(field.state.value);
														const prevEnd = new Date(
															field.form.getFieldValue("end_time"),
														);
														const duration =
															prevEnd.getTime() - prevStart.getTime();

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
																	new Date(
																		new Date(nextStart).getTime() + duration,
																	),
																),
															);
														}
														field.handleChange(nextStart);
													}}
													onBlur={field.handleBlur}
													isError={hasError}
												/>
												{hasError && (
													<p className="text-xs text-red-600 dark:text-red-400">
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
											const startTime =
												fieldApi.form.getFieldValue("start_time");
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
												// Admins may go outside the duration limits
												if (res && startTime && !isAdmin) {
													const minutes =
														(new Date(value).getTime() -
															new Date(startTime).getTime()) /
														60000;
													const broken = checkDuration(minutes, res);
													if (broken === "min" && res.min_duration_minutes) {
														return t(
															"resurssinVahimmaiskesto",
															"Resurssin '{{name}}' varauksen vähimmäiskesto on {{duration}}.",
															{
																name: res.name,
																duration: formatMinutes(
																	res.min_duration_minutes,
																),
															},
														);
													}
													if (broken === "max" && res.max_duration_minutes) {
														return t(
															"resurssinEnimmaiskesto",
															"Resurssin '{{name}}' varauksen enimmäiskesto on {{duration}}.",
															{
																name: res.name,
																duration: formatMinutes(
																	res.max_duration_minutes,
																),
															},
														);
													}
												}
												if (res?.reservable_until) {
													const limit = new Date(
														res.reservable_until,
													).getTime();
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
													className="text-sm font-medium text-stone-900 dark:text-stone-100"
												>
													{t("pttymisaika", "Päättymisaika")}
													<RequiredMark />
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
													<p className="text-xs text-red-600 dark:text-red-400">
														{field.state.meta.errors.join(", ")}
													</p>
												)}
											</div>
										);
									}}
								</form.Field>
							</div>
							{adminOutsideBlocks && (
								<Callout variant="info" icon={CalendarCheck}>
									{t(
										"ajatVarausjaksojenUlkopuolella",
										"Valitut ajat eivät ole varausjakso. Ylläpitäjänä voit silti tallentaa varauksen.",
									)}
								</Callout>
							)}
						</>
					)}

					{/* Recurrence Rule Fields */}
					<form.Subscribe selector={(state) => state.values.resource_ids}>
						{(selectedResourceIds) => {
							const canRecur =
								!blocksOnlyMode &&
								(isAdmin ||
									(selectedResourceIds.length > 0 &&
										selectedResourceIds.every((id) => {
											const resource = resources?.find((r) => r.id === id);
											return (
												(resource as { allow_recurring?: boolean })
													?.allow_recurring ?? true
											);
										})));

							return (
								<RecurrenceSection
									canRecur={canRecur}
									startTime={startTime}
									recurrence={recurrence}
									setRecurrence={setRecurrence}
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
								recurrence={recurrence}
								checkConflicts={checkConflicts}
								conflicts={conflicts}
								setConflicts={setConflicts}
								restrictionConflicts={restrictionConflicts}
								setRestrictionConflicts={setRestrictionConflicts}
								isAdmin={isAdmin}
								userGroupId={currentUser?.group_id}
								reservationId={reservationId}
							/>
						)}
					</form.Subscribe>
				</FormSection>

				<FormSection
					id="reservation-info"
					step={2}
					title={t("varauksenTiedotOsio", "Varauksen tiedot")}
					description={t(
						"osioTiedotKuvaus",
						"Otsikko ja kuvaus näkyvät kaikille kalenterissa, kun varaus on vahvistettu. Älä kirjoita henkilötietoja.",
					)}
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
										className="text-sm font-medium text-stone-900 dark:text-stone-100"
									>
										{t("otsikko", "Otsikko")}
										<RequiredMark />
									</label>
									<Input
										id={field.name}
										aria-required="true"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										isError={hasError}
										placeholder={t("esimViikkokokous", "esim. Viikkokokous")}
									/>
									{hasError && (
										<p className="text-xs text-red-600 dark:text-red-400">
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
								<span className="block text-sm font-medium text-stone-900 dark:text-stone-100">
									{t("kuvaus", "Kuvaus")}
								</span>
								<LocalizedRichTextEditor
									value={field.state.value}
									onChange={field.handleChange}
									label={t("kuvaus", "Kuvaus")}
								/>
							</div>
						)}
					</form.Field>
				</FormSection>

				{/* Contact Details */}
				<FormSection
					id="reservation-contact"
					step={3}
					title={t("osioYhteystiedotJaViestit", "Yhteystiedot ja viestit")}
					description={t(
						"yhteystiedotOhje",
						"Näkyvät vain sinulle ja ylläpidolle.",
					)}
				>
					<div className="space-y-3">
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
										className="text-sm font-medium text-stone-900 dark:text-stone-100"
									>
										{t("yhteyshenkilo", "Yhteyshenkilö")}
										{!isAdmin && <RequiredMark />}
									</label>
									<Input
										id={field.name}
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder={t("yhteyshenkilonNimi", "Yhteyshenkilön nimi")}
										aria-required={!isAdmin}
										isError={Boolean(field.state.meta.errors.length)}
										onBlur={field.handleBlur}
									/>
									{Boolean(field.state.meta.errors.length) && (
										<p className="text-xs text-red-600 dark:text-red-400">
											{field.state.meta.errors.join(", ")}
										</p>
									)}
								</div>
							)}
						</form.Field>

						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
											className="text-xs text-stone-600 dark:text-stone-400"
										>
											{t("yhteysSähköposti", "Sähköposti")}
											{!isAdmin && <RequiredMark />}
										</label>
										<Input
											id={field.name}
											type="email"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											aria-required={!isAdmin}
											placeholder={t(
												"esimYhteysSahkoposti",
												"yhteys@esimerkki.fi",
											)}
											isError={Boolean(field.state.meta.errors.length)}
											onBlur={field.handleBlur}
										/>
										{Boolean(field.state.meta.errors.length) && (
											<p className="text-xs text-red-600 dark:text-red-400">
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
											className="text-xs text-stone-600 dark:text-stone-400"
										>
											{t("puhelinnumero", "Puhelinnumero")}
											{!isAdmin && <RequiredMark />}
										</label>
										<Input
											id={field.name}
											type="tel"
											value={field.state.value}
											onChange={(e) => field.handleChange(e.target.value)}
											placeholder="+358..."
											aria-required={!isAdmin}
											isError={Boolean(field.state.meta.errors.length)}
											onBlur={field.handleBlur}
										/>
										{Boolean(field.state.meta.errors.length) && (
											<p className="text-xs text-red-600 dark:text-red-400">
												{field.state.meta.errors.join(", ")}
											</p>
										)}
									</div>
								)}
							</form.Field>
						</div>
					</div>
					{/* Private message to admins */}
					<form.Field name="message_to_admins">
						{(field) => (
							<div className="space-y-1">
								<label
									htmlFor={field.name}
									className="text-sm font-medium text-stone-900 dark:text-stone-100"
								>
									{t("viestiYllapidolle", "Viesti ylläpidolle")}
								</label>
								<p className="text-xs text-stone-600 dark:text-stone-400">
									{t(
										"viestiYllapidolleOhje",
										"Näkyy vain ylläpidolle, ei kalenterissa.",
									)}
								</p>
								<Textarea
									id={field.name}
									rows={3}
									maxLength={2000}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
								/>
							</div>
						)}
					</form.Field>
				</FormSection>

				{isAdmin && (
					<FormSection
						id="reservation-admin"
						step={4}
						title={t("vainYllapidolle", "Vain ylläpidolle")}
					>
						<div className="space-y-3">
							<form.Field name="admin_notes">
								{(field) => (
									<div className="space-y-0.5">
										<label
											htmlFor={field.name}
											className="text-xs text-stone-600 dark:text-stone-400"
										>
											{t(
												"yllpitjnMuistiinpanotEiOmistajalle",
												"Ylläpitäjän muistiinpanot (varaaja ei näe näitä)",
											)}
										</label>
										<Textarea
											id={field.name}
											rows={3}
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
											className="text-xs text-stone-600 dark:text-stone-400"
										>
											{t("tila", "Tila")}
										</label>
										<Select
											id={field.name}
											value={field.state.value}
											onChange={(e) =>
												field.handleChange(e.target.value as ReservationStatus)
											}
										>
											<option value="confirmed">
												{t("vahvistettu", "Vahvistettu")}
											</option>
											<option value="pending">{t("odottaa", "Odottaa")}</option>
											{/* Cancelling goes through the dedicated cancel action */}
											{field.state.value === "cancelled" && (
												<option value="cancelled">
													{t("peruttu", "Peruttu")}
												</option>
											)}
										</Select>
									</div>
								)}
							</form.Field>
						</div>
					</FormSection>
				)}

				{/* Contract Approval Section */}
				{!isAdmin && (
					<ContractApprovalSection
						contracts={applicableContracts}
						isLoading={loadingContracts}
						approved={contractsApproved}
						onApproveChange={setContractsApproved}
					/>
				)}

				{/* Editing a reservation as a regular user needs a new approval */}
				{!isAdmin && !isCreate && !confirmsImmediately && (
					<Callout variant="warning">
						{t(
							"muokkausPalauttaaOdottaa",
							"Muokkauksen jälkeen ylläpidon pitää hyväksyä varaus uudelleen.",
						)}
					</Callout>
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

						const submitting = isSubmitting || formSubmitting;
						// Say why submit is blocked when the form itself looks valid
						const blockedHint = hasReservationConflict
							? t(
									"lahetysEstettyPaallekkaisyys",
									"Varausta ei voi lähettää, koska valittu aika on jo varattu.",
								)
							: hasRestrictionViolation
								? t(
										"lahetysEstettyRajoitus",
										"Varausta ei voi lähettää, koska valittu aika on rajoitettu.",
									)
								: needsContractApproval
									? t(
											"lahetysEstettyEhdot",
											"Hyväksy sopimusehdot ennen lähettämistä.",
										)
									: undefined;

						return (
							<StickyFormActions
								onCancel={onCancel}
								hint={blockedHint}
								summary={summaryLine}
							>
								<Button
									type="submit"
									disabled={
										!canSubmit ||
										submitting ||
										hasRestrictionViolation ||
										hasReservationConflict ||
										needsContractApproval ||
										(blocksOnlyMode && !hasSelectedBlock)
									}
								>
									{submitting ? (
										<Loader2 className="animate-spin" size={16} />
									) : (
										<Save size={16} />
									)}
									<span>{submitLabel ?? t("tallenna", "Tallenna")}</span>
								</Button>
							</StickyFormActions>
						);
					}}
				</form.Subscribe>
			</GuidedFormLayout>
		</form>
	);
}

interface BlockOption {
	id: string;
	title: string;
	start: Date;
	end: Date;
	selected: boolean;
}

interface BlockPickerProps {
	options: BlockOption[];
	isLoading: boolean;
	onSelect: (option: BlockOption) => void;
}

/** Lets a user choose one of the reservable blocks of a blocks-only resource */
function BlockPicker({ options, isLoading, onSelect }: BlockPickerProps) {
	const { t } = useTranslation();
	const { formatDateRange } = useDateFormatter();

	return (
		<div className="rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900 space-y-3">
			<div className="flex items-center gap-1.5 text-base font-bold text-stone-900 dark:text-stone-100">
				<CalendarCheck size={14} aria-hidden="true" />
				<span>{t("valitseVarausjakso", "Valitse varausjakso")}</span>
			</div>

			{isLoading ? (
				<div className="flex items-center gap-2 text-xs text-stone-500 py-1">
					<Loader2 className="animate-spin" size={14} />
					<span>{t("ladataanVarausjaksoja", "Ladataan varausjaksoja...")}</span>
				</div>
			) : options.length === 0 ? (
				<p className="text-xs text-stone-600 dark:text-stone-400">
					{t(
						"eiVapaitaVarausjaksoja",
						"Tälle resurssille ei ole vapaita varausjaksoja.",
					)}
				</p>
			) : (
				<ul className="space-y-1 max-h-56 overflow-y-auto">
					{options.map((opt) => (
						<li key={opt.id}>
							<button
								type="button"
								aria-pressed={opt.selected}
								onClick={() => onSelect(opt)}
								className={`focus-ring w-full text-left px-3 py-2 text-sm rounded-md border transition-colors ${
									opt.selected
										? "bg-stone-900 text-stone-50 border-stone-900 dark:bg-stone-200 dark:text-stone-900 dark:border-stone-200"
										: "bg-stone-50 dark:bg-stone-950 border-stone-300 dark:border-stone-700 hover:border-stone-800 dark:hover:border-stone-300"
								}`}
							>
								<span className="font-semibold">{opt.title}</span>
								<span className="block text-xs tabular-nums opacity-80">
									{formatDateRange(opt.start, opt.end)}
								</span>
							</button>
						</li>
					))}
				</ul>
			)}

			<p className="text-xs text-stone-600 dark:text-stone-400">
				{t(
					"varausjaksoOhje",
					"Tämän resurssin voi varata vain kokonaisina varausjaksoina.",
				)}
			</p>
		</div>
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
		<div className="rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900 space-y-3">
			<div className="flex items-center gap-1.5 text-base font-bold text-stone-900 dark:text-stone-100">
				<FileText size={16} aria-hidden="true" />
				<span>{t("sopimuksetJaEhot", "Sopimukset ja ehdot")}</span>
			</div>

			<p className="text-xs text-stone-600 dark:text-stone-400">
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
							<span className="font-medium text-stone-800 dark:text-stone-200 truncate">
								{getLocalizedText(contract.title, currentLocale)}
							</span>
							<a
								href={hrefUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="shrink-0 pl-2 text-xs font-semibold text-purple-700 dark:text-purple-400 hover:underline"
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
					className="focus-ring mt-0.5 h-4 w-4 rounded border-stone-400 accent-purple-600"
				/>
				<span className="text-sm font-medium text-stone-900 dark:text-stone-100 leading-tight">
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
	recurrence: RRuleConfig;
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
	/** Restrictions that exempt this group are not reported */
	userGroupId?: string;
	reservationId?: string;
}

function AutomaticConflictChecker({
	resourceIds,
	startTime,
	endTime,
	recurrence,
	checkConflicts,
	conflicts,
	setConflicts,
	restrictionConflicts,
	setRestrictionConflicts,
	isAdmin,
	userGroupId,
	reservationId,
}: AutomaticConflictCheckerProps) {
	const { t } = useTranslation();
	const { formatRange } = useDateFormatter();
	const mutateAsync = checkConflicts.mutateAsync;

	// Last day of the series, which bounds the restrictions worth fetching
	const seriesEnd = recurrence.count
		? (listSeriesStarts(startTime, recurrence).at(-1) ?? null)
		: (recurrence.until ?? null);

	const { data: activeRestrictions } = useRestrictions({
		start_date: startTime ? new Date(startTime).toISOString() : undefined,
		// Through the end of the last day of the series
		end_date: seriesEnd
			? localDayRangeISO(seriesEnd, seriesEnd).endISO
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

		let allOccurrences: CreateOccurrencePayload[] = [];
		for (const resourceId of resourceIds) {
			const { occurrences } = generateOccurrences(
				startTime,
				endTime,
				resourceId,
				recurrence,
			);
			allOccurrences = [...allOccurrences, ...occurrences];
		}

		if (allOccurrences.length === 0) {
			setConflicts(null);
			setRestrictionConflicts(null);
			return;
		}

		if (!isAdmin && activeRestrictions && activeRestrictions.length > 0) {
			setRestrictionConflicts(
				findRestrictionConflicts(
					allOccurrences,
					activeRestrictions,
					userGroupId,
				),
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
		recurrence,
		activeRestrictions,
		isAdmin,
		userGroupId,
		reservationId,
		mutateAsync,
		setConflicts,
		setRestrictionConflicts,
	]);

	if (checkConflicts.isPending) {
		return (
			<div className="flex items-center justify-center py-2 text-xs text-stone-600 dark:text-stone-400 gap-2">
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
			<Callout variant="success">
				{t("eiPllekkisiVarauksia", "Ei päällekkäisiä varauksia.")}
			</Callout>
		);
	}

	return (
		<div className="space-y-2">
			{hasRestrictionViolations && (
				<Callout
					variant="warning"
					icon={ShieldAlert}
					title={t(
						"varausOsuuRajoitetulleAjalle",
						"Varaus osuu rajoitetulle ajanjaksolle! ({{length}})",
						{ length: restrictionConflicts.length },
					)}
				>
					<ul className="list-inside list-disc tabular-nums">
						{restrictionConflicts.map((item) => (
							<li key={`${item.title}-${item.start_time}-${item.end_time}`}>
								<span className="font-medium">
									{item.title}
									{":"}
								</span>{" "}
								{formatRange(item.start_time, item.end_time)}
							</li>
						))}
					</ul>
				</Callout>
			)}

			{hasReservationConflicts && (
				<Callout
					variant="danger"
					title={t(
						"lytyiLengthPllekkistVarausta",
						"Löytyi {{length}} päällekkäistä varausta!",
						{ length: conflicts.length },
					)}
				>
					<ul className="list-inside list-disc tabular-nums">
						{conflicts.map((occ) => (
							<li key={occ.id}>{formatRange(occ.start_time, occ.end_time)}</li>
						))}
					</ul>
				</Callout>
			)}
		</div>
	);
}

interface RecurrenceSectionProps {
	canRecur: boolean;
	startTime: string;
	recurrence: RRuleConfig;
	setRecurrence: (recurrence: RRuleConfig) => void;
	setConflicts: (conflicts: Occurrence[] | null) => void;
}

function RecurrenceSection({
	canRecur,
	startTime,
	recurrence,
	setRecurrence,
	setConflicts,
}: RecurrenceSectionProps) {
	const { t } = useTranslation();
	useEffect(() => {
		if (!canRecur && recurrence.freq !== "none") {
			setRecurrence(NO_RECURRENCE);
			setConflicts(null);
		}
	}, [canRecur, recurrence.freq, setRecurrence, setConflicts]);

	if (!canRecur) {
		return null;
	}

	return (
		<div className="rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900 space-y-3">
			<div className="flex items-center gap-1.5 text-base font-bold text-stone-900 dark:text-stone-100">
				<RefreshCw size={16} aria-hidden="true" />
				<span>{t("toistuvuus", "Toistuvuus")}</span>
			</div>

			<RecurrenceFields
				startTime={startTime}
				value={recurrence}
				onChange={setRecurrence}
			/>
		</div>
	);
}
