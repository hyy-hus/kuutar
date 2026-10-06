import { useForm } from "@tanstack/react-form";
import { Loader2, Save } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Input } from "#/components/Input";
import { LocalizedRichTextEditor } from "#/components/LocalizedRichTextEditor";
import type { CreateCollection } from "#/hooks/useCollections";
import { cn } from "#/utils/cn";
import { COLLECTION_ICONS, getCollectionIcon } from "#/utils/collectionIcons";
import {
	compactLocalizedRichText,
	toLocalizedRichText,
} from "#/utils/richText";

interface CollectionFormProps {
	defaultValues?: Partial<CreateCollection>;
	onSubmit: (values: CreateCollection) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
}

export function CollectionForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
}: CollectionFormProps) {
	const { t } = useTranslation();
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			description: toLocalizedRichText(defaultValues?.description),
			icon: defaultValues?.icon ?? "",
		},
		onSubmit: async ({ value }) => {
			await onSubmit({
				...value,
				// An empty object clears a stored description; null would keep it
				description: compactLocalizedRichText(value.description) ?? {},
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
								{t("kokoelmanNimi", "Kokoelman nimi")}
							</label>
							<Input
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={hasError}
								placeholder={t("esimPrakennus", "esim. Päärakennus")}
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

			<form.Field name="icon">
				{(field) => (
					<fieldset className="space-y-1">
						<legend className="text-xs font-medium text-stone-700 dark:text-stone-300">
							{t("kuvake", "Kuvake")}
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
								{t("oletuskuvake", "Oletus")}
							</button>
							{COLLECTION_ICONS.map((key) => {
								const Icon = getCollectionIcon(key);
								return (
									<button
										key={key}
										type="button"
										aria-label={key}
										aria-pressed={field.state.value === key}
										onClick={() => field.handleChange(key)}
										className={cn(
											"size-8 flex items-center justify-center rounded-sm border cursor-pointer",
											field.state.value === key
												? "border-stone-900 dark:border-stone-100 bg-stone-200 dark:bg-stone-800"
												: "border-stone-300 dark:border-stone-700",
										)}
									>
										<Icon size={16} />
									</button>
								);
							})}
						</div>
					</fieldset>
				)}
			</form.Field>

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
