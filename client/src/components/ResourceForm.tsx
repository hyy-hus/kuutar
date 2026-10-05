import { useForm } from "@tanstack/react-form";
import { Eye, FileText, Loader2, Save, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LocalizedRichTextEditor } from "#/components/LocalizedRichTextEditor";
import { useCollections } from "#/hooks/useCollections";
import { getLocalizedText, useContracts } from "#/hooks/useContracts";
import { useGroups } from "#/hooks/useGroups";
import type { CreateResource } from "#/hooks/useResorces";
import { cn } from "#/utils/cn";
import { formatYYYYMMDD } from "#/utils/date";
import { getResourceColor, RESOURCE_COLORS } from "#/utils/resourceColors";
import {
	compactLocalizedRichText,
	toLocalizedRichText,
} from "#/utils/richText";
import { Button } from "./Button";
import { Input } from "./Input";

export interface ResourceFormValues
	extends Omit<CreateResource, "reservable_until"> {
	reservable_until?: string | null;
	is_public?: boolean;
	color?: string | null;
	reservation_restricted?: boolean;
	group_ids?: string[];
	contract_ids?: string[];
}

interface ResourceFormProps {
	defaultValues?: Partial<ResourceFormValues>;
	onSubmit: (values: ResourceFormValues) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
}

/** Turns an ISO timestamp into the YYYY-MM-DD value of a date input */
const toDateInputValue = (isoStr?: string | null) => {
	if (!isoStr) return "";
	const date = new Date(isoStr);
	return Number.isNaN(date.getTime()) ? "" : formatYYYYMMDD(date);
};

export function ResourceForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
}: ResourceFormProps) {
	const { t, i18n } = useTranslation();
	const { data: collections, isLoading: loadingCollections } = useCollections();
	const { data: contracts, isLoading: loadingContracts } = useContracts({
		active_only: true,
	});

	const { data: groups, isLoading: loadingGroups } = useGroups();

	const resourceContracts = contracts?.filter((c) => !c.is_global) ?? [];

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			description: toLocalizedRichText(defaultValues?.description),
			collection_id: defaultValues?.collection_id ?? "",
			allow_recurring: defaultValues?.allow_recurring ?? true,
			blocks_only: defaultValues?.blocks_only ?? false,
			is_public: defaultValues?.is_public ?? true,
			reservation_restricted: defaultValues?.reservation_restricted ?? false,
			group_ids: defaultValues?.group_ids ?? [],
			color: defaultValues?.color ?? "",
			reservable_until: toDateInputValue(defaultValues?.reservable_until),
			contract_ids: defaultValues?.contract_ids ?? [],
		},
		onSubmit: async ({ value }) => {
			const formattedUntil = value.reservable_until
				? new Date(`${value.reservable_until}T23:59:59.999Z`).toISOString()
				: null;

			await onSubmit({
				...value,
				// An empty object clears a stored description; null would keep it
				description: compactLocalizedRichText(value.description) ?? {},
				is_public: value.is_public ?? false,
				reservable_until: formattedUntil,
			});
		},
	});

	if (loadingCollections) {
		return (
			<div className="text-sm text-stone-500">
				{t("ladataanKokoelmia", "Ladataan kokoelmia...")}
			</div>
		);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="space-y-4 max-w-md"
		>
			{/* Resource Name */}
			<form.Field
				name="name"
				validators={{
					onChange: ({ value }) =>
						!value ? t("nimiOnPakollinen", "Nimi on pakollinen") : undefined,
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
								{t("resurssinNimi", "Resurssin nimi")}
							</label>
							<Input
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={hasError}
								placeholder={t("esimSauna1", "esim. Sauna 1")}
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

			<form.Field name="description">
				{(field) => (
					<div className="space-y-1">
						<span className="text-xs font-medium text-stone-700 dark:text-stone-300">
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

			{/* Collection Selection */}
			<form.Field
				name="collection_id"
				validators={{
					onChange: ({ value }) =>
						!value ? t("kokoelmaOnPakollinen", "Valitse kokoelma") : undefined,
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
								{t("kokoelma", "Kokoelma")}
							</label>
							<select
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
							>
								<option value="" disabled>
									{t("valitseKokoelma", "Valitse kokoelma...")}
								</option>
								{collections?.map((col) => (
									<option key={col.id} value={col.id}>
										{col.name}
									</option>
								))}
							</select>
							{hasError && (
								<p className="text-[11px] text-red-500">
									{field.state.meta.errors.join(", ")}
								</p>
							)}
						</div>
					);
				}}
			</form.Field>

			{/* Calendar color */}
			<form.Field name="color">
				{(field) => (
					<fieldset className="space-y-1">
						<legend className="text-xs font-medium text-stone-700 dark:text-stone-300">
							{t("vari", "Väri kalenterissa")}
						</legend>
						<div className="flex flex-wrap items-center gap-2">
							<button
								type="button"
								aria-pressed={!field.state.value}
								onClick={() => field.handleChange("")}
								className={cn(
									"px-2 py-1 rounded-sm text-xs border cursor-pointer",
									!field.state.value
										? "border-stone-900 dark:border-stone-100 font-semibold"
										: "border-stone-300 dark:border-stone-700",
								)}
							>
								{t("eiVaria", "Ei väriä")}
							</button>
							{RESOURCE_COLORS.map((key) => (
								<button
									key={key}
									type="button"
									aria-label={key}
									aria-pressed={field.state.value === key}
									onClick={() => field.handleChange(key)}
									className={cn(
										"size-6 rounded-full cursor-pointer ring-offset-2 ring-offset-stone-50 dark:ring-offset-stone-950",
										getResourceColor(key)?.swatch,
										field.state.value === key &&
											"ring-2 ring-stone-900 dark:ring-stone-100",
									)}
								/>
							))}
						</div>
					</fieldset>
				)}
			</form.Field>

			{/* Reservable Until Cutoff Date */}
			<form.Field name="reservable_until">
				{(field) => (
					<div className="space-y-1">
						<label
							htmlFor={field.name}
							className="text-xs font-medium text-stone-700 dark:text-stone-300"
						>
							{t("varattavissaAsti", "Varattavissa enintään päivämäärään asti")}
						</label>
						<Input
							id={field.name}
							type="date"
							value={field.state.value}
							onChange={(e) => field.handleChange(e.target.value)}
							onBlur={field.handleBlur}
						/>
						<p className="text-[11px] text-stone-500 dark:text-stone-400">
							{t(
								"varattavissaAstiOhje",
								"Jätä tyhjäksi, jos varauksille ei ole takarajaa.",
							)}
						</p>
					</div>
				)}
			</form.Field>

			{/* Visibility & Recurrence Toggles */}
			<div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
				{/* Is Public Toggle */}
				<form.Field name="is_public">
					{(field) => (
						<div className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
							<input
								type="checkbox"
								id={field.name}
								checked={field.state.value}
								onChange={(e) => field.handleChange(e.target.checked)}
								className="w-4 h-4 text-purple-600 rounded border-stone-300 focus:ring-purple-500 dark:border-stone-700 dark:bg-stone-950"
							/>
							<label
								htmlFor={field.name}
								className="text-xs font-medium text-stone-800 dark:text-stone-200 cursor-pointer select-none flex items-center gap-1.5"
							>
								<Eye
									size={14}
									className="text-purple-600 dark:text-purple-400"
								/>
								<span>
									{t(
										"julkinenResurssi",
										"Julkinen resurssi (näkyy kaikille käyttäjille)",
									)}
								</span>
							</label>
						</div>
					)}
				</form.Field>

				{/* Allow Recurring Toggle */}
				<form.Field name="allow_recurring">
					{(field) => (
						<div className="flex items-center gap-3 p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
							<input
								type="checkbox"
								id={field.name}
								checked={field.state.value}
								onChange={(e) => field.handleChange(e.target.checked)}
								className="w-4 h-4 text-purple-600 rounded border-stone-300 focus:ring-purple-500 dark:border-stone-700 dark:bg-stone-950"
							/>
							<label
								htmlFor={field.name}
								className="text-xs font-medium text-stone-800 dark:text-stone-200 cursor-pointer select-none"
							>
								{t(
									"salliToistuvatVarauksetTlleResurssille",
									"Salli toistuvat varaukset tälle resurssille",
								)}
							</label>
						</div>
					)}
				</form.Field>

				{/* Reservation Restricted Toggle + allowed groups */}
				<form.Field name="reservation_restricted">
					{(field) => (
						<div className="p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md space-y-2">
							<div className="flex items-center gap-3">
								<input
									type="checkbox"
									id={field.name}
									checked={field.state.value ?? false}
									onChange={(e) => field.handleChange(e.target.checked)}
									className="w-4 h-4 text-purple-600 rounded border-stone-300 focus:ring-purple-500 dark:border-stone-700 dark:bg-stone-950"
								/>
								<label
									htmlFor={field.name}
									className="text-xs font-medium text-stone-800 dark:text-stone-200 cursor-pointer select-none flex items-center gap-1.5"
								>
									<Users
										size={14}
										className="text-purple-600 dark:text-purple-400"
									/>
									<span>
										{t(
											"vainValitutRyhmatVoivatVarata",
											"Vain valitut ryhmät voivat varata",
										)}
									</span>
								</label>
							</div>
							<p className="text-[11px] text-stone-500 pl-7">
								{t(
									"vainValitutRyhmatOhje",
									"Resurssi näkyy kaikille, mutta varata voivat vain valitut ryhmät ja ylläpitäjät. Olemassa olevia varauksia ei muuteta.",
								)}
							</p>

							{field.state.value && (
								<form.Field name="group_ids">
									{(groupField) =>
										loadingGroups ? (
											<div className="text-xs text-stone-500 py-2">
												{t("ladataanRyhmia", "Ladataan ryhmiä...")}
											</div>
										) : (
											<div className="space-y-1.5 max-h-36 overflow-y-auto p-2 ml-7 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md">
												{groups?.map((grp) => {
													const isChecked = groupField.state.value.includes(
														grp.id,
													);
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
																		? [...groupField.state.value, grp.id]
																		: groupField.state.value.filter(
																				(id) => id !== grp.id,
																			);
																	groupField.handleChange(next);
																}}
																className="w-4 h-4 text-purple-600 rounded border-stone-300 focus:ring-purple-500"
															/>
															<span>{grp.name}</span>
														</label>
													);
												})}
											</div>
										)
									}
								</form.Field>
							)}
						</div>
					)}
				</form.Field>

				{/* Blocks Only Toggle */}
				<form.Field name="blocks_only">
					{(field) => (
						<div className="p-3 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md space-y-1">
							<div className="flex items-center gap-3">
								<input
									type="checkbox"
									id={field.name}
									checked={field.state.value ?? false}
									onChange={(e) => field.handleChange(e.target.checked)}
									className="w-4 h-4 text-purple-600 rounded border-stone-300 focus:ring-purple-500 dark:border-stone-700 dark:bg-stone-950"
								/>
								<label
									htmlFor={field.name}
									className="text-xs font-medium text-stone-800 dark:text-stone-200 cursor-pointer select-none"
								>
									{t(
										"vainVarausjaksot",
										"Varattavissa vain ylläpitäjän määrittelemissä varausjaksoissa",
									)}
								</label>
							</div>
							<p className="text-[11px] text-stone-500 pl-7">
								{t(
									"vainVarausjaksotOhje",
									"Käyttäjät voivat varata vain kokonaisia varausjaksoja. Ylläpitäjä voi edelleen tehdä varauksia jaksojen ulkopuolelle.",
								)}
							</p>
						</div>
					)}
				</form.Field>
			</div>

			{/* Resource Contracts Selection */}
			<form.Field name="contract_ids">
				{(field) => (
					<div className="space-y-1.5 pt-2 border-t border-stone-200 dark:border-stone-800">
						<div className="flex items-center gap-1.5">
							<FileText
								size={14}
								className="text-amber-600 dark:text-amber-500"
							/>
							<span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
								{t("liitetytSopimukset", "Liitetyt sopimukset ja säännöt")}
							</span>
						</div>
						<p className="text-[11px] text-stone-500 dark:text-stone-400">
							{t(
								"valitseSopimuksetKuvaus",
								"Valitse tähän resurssiin sovellettavat kohdekohtaiset sopimusasiakirjat. (Yleiset sopimukset pätevät automaattisesti).",
							)}
						</p>

						{loadingContracts ? (
							<div className="text-xs text-stone-500 py-2 flex items-center gap-2">
								<Loader2 className="animate-spin" size={14} />
								<span>{t("ladataanSopimuksia", "Ladataan sopimuksia...")}</span>
							</div>
						) : resourceContracts.length > 0 ? (
							<div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
								{resourceContracts.map((contract) => {
									const isChecked = field.state.value.includes(contract.id);
									const checkboxId = `contract-check-${contract.id}`;
									const title = getLocalizedText(contract.title, i18n.language);

									return (
										<div
											key={contract.id}
											className="flex items-center gap-2.5 p-1.5 hover:bg-stone-100 dark:hover:bg-stone-800 rounded transition-colors"
										>
											<input
												type="checkbox"
												id={checkboxId}
												checked={isChecked}
												onChange={(e) => {
													const next = e.target.checked
														? [...field.state.value, contract.id]
														: field.state.value.filter(
																(id) => id !== contract.id,
															);
													field.handleChange(next);
												}}
												className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500 dark:border-stone-700 dark:bg-stone-950"
											/>
											<label
												htmlFor={checkboxId}
												className="text-xs text-stone-800 dark:text-stone-200 font-medium cursor-pointer flex-1 truncate"
											>
												{title}
											</label>
										</div>
									);
								})}
							</div>
						) : (
							<div className="p-3 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/50 rounded border border-stone-200 dark:border-stone-800">
								{t(
									"eiKohdekohtaisiaSopimuksia",
									"Ei kohdekohtaisia sopimuksia saatavilla.",
								)}
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
				)}
			</form.Subscribe>
		</form>
	);
}
