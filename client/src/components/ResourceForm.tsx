// client/src/components/ResourceForm.tsx

import { FileText, Loader2, Save } from "lucide-react";
import { Button } from "./Button";
import type { CreateResource } from "#/hooks/useResorces";
import { useTranslation } from "react-i18next";
import { getLocalizedText, useContracts } from "#/hooks/useContracts";
import { useCollections } from "#/hooks/useCollections";
import { useForm } from "@tanstack/react-form";
import { Input } from "./Input";

export interface ResourceFormValues extends CreateResource {
	contract_ids?: string[];
}

interface ResourceFormProps {
	defaultValues?: Partial<ResourceFormValues>;
	onSubmit: (values: ResourceFormValues) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
}

export function ResourceForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel = "Tallenna",
}: ResourceFormProps) {
	const { t, i18n } = useTranslation();
	const { data: collections, isLoading: loadingCollections } = useCollections();
	const { data: contracts, isLoading: loadingContracts } = useContracts({
		active_only: true,
	});

	const resourceContracts = contracts?.filter((c) => !c.is_global) ?? [];

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			collection_id: defaultValues?.collection_id ?? "",
			allow_recurring: defaultValues?.allow_recurring ?? true,
			contract_ids: defaultValues?.contract_ids ?? [],
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value);
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

			{/* Collection Selection */}
			<form.Field
				name="collection_id"
				validators={{
					onChange: ({ value }) => (!value ? "Valitse kokoelma" : undefined),
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
								<span>{submitLabel}</span>
							</>
						)}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
