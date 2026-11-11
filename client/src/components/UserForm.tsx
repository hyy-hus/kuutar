import { useForm } from "@tanstack/react-form";
import { AlertCircle, Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { FormActions } from "#/components/FormActions";
import { FormSection } from "#/components/FormSection";
import { Input } from "#/components/Input";
import { LanguageSelect } from "#/components/LanguageSelect";
import { Select } from "#/components/Select";
import { useGroups } from "#/hooks/useGroups";

export interface UserFormValues {
	name: string;
	email: string;
	group_id: string;
	language: string;
	password?: string;
}

interface UserFormProps {
	defaultValues?: Partial<UserFormValues>;
	onSubmit: (values: UserFormValues) => Promise<void>;
	isSubmitting?: boolean;
	submitLabel?: string;
	isCreate?: boolean;
	/** Shows the ghost "Peruuta" button next to the submit button */
	onCancel?: () => void;
}

export function UserForm({
	defaultValues,
	onSubmit,
	isSubmitting = false,
	submitLabel,
	isCreate = false,
	onCancel,
}: UserFormProps) {
	const { t } = useTranslation();
	const { data: groups, isLoading: loadingGroups } = useGroups();

	const form = useForm({
		defaultValues: {
			name: defaultValues?.name ?? "",
			email: defaultValues?.email ?? "",
			group_id: defaultValues?.group_id ?? "",
			language: defaultValues?.language ?? "fi",
			password: defaultValues?.password ?? "",
		},
		onSubmit: async ({ value }) => {
			await onSubmit(value);
		},
	});

	if (loadingGroups) {
		return (
			<div className="text-sm text-stone-500">
				{t("ladataanRyhmi", "Ladataan ryhmiä...")}
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
					{(field) => (
						<Field
							id={field.name}
							label={t("nimi", "Nimi")}
							required
							errors={field.state.meta.errors}
						>
							<Input
								id={field.name}
								type="text"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={Boolean(field.state.meta.errors.length)}
								aria-required="true"
								placeholder={t("esimNimi", "Matti Meikäläinen")}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="email"
					validators={{
						onChange: ({ value }) =>
							!value
								? t("shkpostiOnPakollinen", "Sähköposti on pakollinen")
								: !/\S+@\S+\.\S+/.test(value)
									? t(
											"annaKelvollinenSahkoposti",
											"Anna kelvollinen sähköpostiosoite",
										)
									: undefined,
					}}
				>
					{(field) => (
						<Field
							id={field.name}
							label={t("shkposti", "Sähköposti")}
							required
							errors={field.state.meta.errors}
						>
							<Input
								id={field.name}
								type="email"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={Boolean(field.state.meta.errors.length)}
								aria-required="true"
								placeholder={t("esimSahkoposti", "nimi@esimerkki.fi")}
							/>
						</Field>
					)}
				</form.Field>

				<form.Field
					name="group_id"
					validators={{
						onChange: ({ value }) =>
							!value ? t("valitseRyhma", "Valitse ryhmä") : undefined,
					}}
				>
					{(field) => (
						<Field
							id={field.name}
							label={t("ryhm", "Ryhmä")}
							required
							errors={field.state.meta.errors}
						>
							<Select
								id={field.name}
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={Boolean(field.state.meta.errors.length)}
								aria-required="true"
							>
								<option value="" disabled>
									{t("valitseRyhm", "Valitse ryhmä...")}
								</option>
								{groups?.map((grp) => (
									<option key={grp.id} value={grp.id}>
										{grp.name}
									</option>
								))}
							</Select>
						</Field>
					)}
				</form.Field>

				<form.Field name="language">
					{(field) => (
						<Field
							id={field.name}
							label={t("kieli", "Kieli")}
							helper={t(
								"kieliKuvausSahkoposti",
								"Käyttäjän sähköpostiviestit lähetetään tällä kielellä.",
							)}
						>
							<LanguageSelect
								id={field.name}
								value={field.state.value}
								onChange={field.handleChange}
								onBlur={field.handleBlur}
							/>
						</Field>
					)}
				</form.Field>
			</FormSection>

			<FormSection title={t("salasana", "Salasana")}>
				<form.Field
					name="password"
					validators={{
						onChange: ({ value }) =>
							isCreate && !value
								? t("salasanaOnPakollinen", "Salasana on pakollinen")
								: value && value.length < 8
									? t(
											"salasananOnOltavaVhintn8Merkki",
											"Salasanan on oltava vähintään 8 merkkiä",
										)
									: undefined,
					}}
				>
					{(field) => (
						<Field
							id={field.name}
							label={
								isCreate
									? t("salasana", "Salasana")
									: t(
											"uusiSalasanaJtTyhjksiJosEiMuuteta",
											"Uusi salasana (jätä tyhjäksi jos ei muuteta)",
										)
							}
							required={isCreate}
							errors={field.state.meta.errors}
						>
							<Input
								id={field.name}
								type="password"
								value={field.state.value}
								onChange={(e) => field.handleChange(e.target.value)}
								onBlur={field.handleBlur}
								isError={Boolean(field.state.meta.errors.length)}
								aria-required={isCreate ? "true" : undefined}
								autoComplete="new-password"
								placeholder="••••••••"
							/>
						</Field>
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

function Field({
	id,
	label,
	required,
	helper,
	errors,
	children,
}: {
	id: string;
	label: string;
	required?: boolean;
	helper?: string;
	errors?: unknown[];
	children: ReactNode;
}) {
	return (
		<div className="space-y-1">
			<label
				htmlFor={id}
				className="text-sm font-medium text-stone-900 dark:text-stone-100"
			>
				{label}
				{required && (
					<span aria-hidden="true" className="text-red-600">
						{" *"}
					</span>
				)}
			</label>
			{children}
			{helper && (
				<p className="text-xs text-stone-600 dark:text-stone-400">{helper}</p>
			)}
			{errors && errors.length > 0 && (
				<p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
					<AlertCircle size={12} aria-hidden="true" />
					{errors.join(", ")}
				</p>
			)}
		</div>
	);
}
