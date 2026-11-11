import { useForm } from "@tanstack/react-form";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { FormActions } from "#/components/FormActions";
import { FormSection } from "#/components/FormSection";
import { Input } from "#/components/Input";
import { LocalizedRichTextEditor } from "#/components/LocalizedRichTextEditor";
import type { CreateGroup } from "#/hooks/useGroups";
import {
	compactLocalizedRichText,
	toLocalizedRichText,
} from "#/utils/richText";

interface GroupFormProps {
	defaultValues?: Partial<CreateGroup>;
	onSubmit: (values: CreateGroup) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
	/** Shows the ghost "Peruuta" button next to the submit button */
	onCancel?: () => void;
}

export function GroupForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	onCancel,
}: GroupFormProps) {
	const { t } = useTranslation();
	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			description: toLocalizedRichText(defaultValues?.description),
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
			className="space-y-6"
		>
			<FormSection title={t("perustiedot", "Perustiedot")}>
				<form.Field
					name="name"
					validators={{
						onChange: ({ value }) =>
							!value ? t("nimiOnPakollinen", "Nimi on pakollinen") : undefined,
					}}
				>
					{(field) => {
						const errors = field.state.meta.errors;
						return (
							<div className="space-y-1">
								<label
									htmlFor={field.name}
									className="text-sm font-medium text-stone-900 dark:text-stone-100"
								>
									{t("ryhmnNimi", "Ryhmän nimi")}
									<span aria-hidden="true" className="text-red-600">
										{" *"}
									</span>
								</label>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									isError={errors.length > 0}
									aria-required="true"
									placeholder={t("esimYllpitjt", "esim. Ylläpitäjät")}
								/>
								{errors.length > 0 && (
									<p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
										<AlertCircle size={12} aria-hidden="true" />
										{errors.join(", ")}
									</p>
								)}
							</div>
						);
					}}
				</form.Field>

				<form.Field name="description">
					{(field) => (
						<div className="space-y-1">
							<span className="text-sm font-medium text-stone-900 dark:text-stone-100">
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

			<form.Subscribe
				selector={(state) => [state.canSubmit, state.isSubmitting]}
			>
				{([canSubmit, formSubmitting]) => (
					<FormActions onCancel={onCancel}>
						<Button
							type="submit"
							disabled={!canSubmit || isSubmitting || formSubmitting}
						>
							{(isSubmitting || formSubmitting) && (
								<Loader2 className="animate-spin" size={16} />
							)}
							<span>{submitLabel ?? t("tallenna", "Tallenna")}</span>
						</Button>
					</FormActions>
				)}
			</form.Subscribe>
		</form>
	);
}
