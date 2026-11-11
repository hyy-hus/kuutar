import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { FormActions } from "#/components/FormActions";
import { FormLayout } from "#/components/FormLayout";
import { FormSection } from "#/components/FormSection";
import { Input } from "#/components/Input";
import { LanguageSelect } from "#/components/LanguageSelect";
import { PageHeader } from "#/components/PageHeader";
import { SessionList } from "#/components/SessionList";
import { useAuth } from "#/hooks/useAuth";
import {
	useLogoutOtherSessions,
	useMySessions,
	useRevokeMySession,
} from "#/hooks/useSessions";
import { useUpdateMe } from "#/hooks/useUsers";
import { requireAuthGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/me")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: MePage,
});

function FieldError({ errors }: { errors: unknown[] }) {
	if (errors.length === 0) return null;
	return (
		<p className="text-xs text-red-600 dark:text-red-400">
			{errors.join(", ")}
		</p>
	);
}

function MePage() {
	const { t } = useTranslation();
	const { user } = useAuth();
	const updateMe = useUpdateMe();
	const { data: sessions } = useMySessions();
	const revokeSession = useRevokeMySession();
	const logoutOthers = useLogoutOtherSessions();
	const [saved, setSaved] = useState(false);

	const form = useForm({
		defaultValues: {
			name: user?.name ?? "",
			email: user?.email ?? "",
			password: "",
			language: user?.language ?? "fi",
			default_contact_person: user?.default_contact_person ?? "",
			default_contact_email: user?.default_contact_email ?? "",
			default_contact_phone: user?.default_contact_phone ?? "",
		},
		onSubmit: async ({ value }) => {
			setSaved(false);
			const { password, ...rest } = value;
			// Empty contact strings clear the saved default on the server
			await updateMe.mutateAsync({
				...rest,
				...(password ? { password } : {}),
			});
			form.setFieldValue("password", "");
			setSaved(true);
		},
	});

	if (!user) return null;

	const labelClass = "text-sm font-medium text-stone-900 dark:text-stone-100";

	return (
		<FormLayout>
			<PageHeader title={t("omatTiedot", "Omat tiedot")} />

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
								!value.trim()
									? t("nimiOnPakollinen", "Nimi on pakollinen")
									: undefined,
						}}
					>
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("nimi", "Nimi")}
								</label>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									isError={field.state.meta.errors.length > 0}
								/>
								<FieldError errors={field.state.meta.errors} />
							</div>
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
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("shkposti", "Sähköposti")}
								</label>
								<Input
									id={field.name}
									type="email"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									isError={field.state.meta.errors.length > 0}
								/>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>

					<form.Field name="language">
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("kieli", "Kieli")}
								</label>
								<LanguageSelect
									id={field.name}
									value={field.state.value}
									onChange={field.handleChange}
									onBlur={field.handleBlur}
								/>
								<p className="text-xs text-stone-600 dark:text-stone-400">
									{t(
										"kieliKuvausSahkoposti",
										"Käyttäjän sähköpostiviestit lähetetään tällä kielellä.",
									)}
								</p>
							</div>
						)}
					</form.Field>
				</FormSection>

				<FormSection
					title={t("oletusyhteystiedot", "Oletusyhteystiedot")}
					description={t(
						"oletusyhteystiedotKuvaus",
						"Täytetään valmiiksi uusiin varauksiin.",
					)}
				>
					<form.Field name="default_contact_person">
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t("yhteyshenkilo", "Yhteyshenkilö")}
								</label>
								<Input
									id={field.name}
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									placeholder={t("yhteyshenkilonNimi", "Yhteyshenkilön nimi")}
								/>
							</div>
						)}
					</form.Field>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<form.Field
							name="default_contact_email"
							validators={{
								onChange: ({ value }) =>
									value && !/\S+@\S+\.\S+/.test(value)
										? t(
												"annaKelvollinenSahkoposti",
												"Anna kelvollinen sähköpostiosoite",
											)
										: undefined,
							}}
						>
							{(field) => (
								<div className="space-y-1">
									<label htmlFor={field.name} className={labelClass}>
										{t("yhteysSähköposti", "Sähköposti")}
									</label>
									<Input
										id={field.name}
										type="email"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										onBlur={field.handleBlur}
										isError={field.state.meta.errors.length > 0}
										placeholder={t(
											"esimYhteysSahkoposti",
											"yhteys@esimerkki.fi",
										)}
									/>
									<FieldError errors={field.state.meta.errors} />
								</div>
							)}
						</form.Field>

						<form.Field name="default_contact_phone">
							{(field) => (
								<div className="space-y-1">
									<label htmlFor={field.name} className={labelClass}>
										{t("puhelinnumero", "Puhelinnumero")}
									</label>
									<Input
										id={field.name}
										type="tel"
										value={field.state.value}
										onChange={(e) => field.handleChange(e.target.value)}
										placeholder="+358..."
									/>
								</div>
							)}
						</form.Field>
					</div>
				</FormSection>

				<FormSection title={t("salasana", "Salasana")}>
					<form.Field
						name="password"
						validators={{
							onChange: ({ value }) =>
								value && value.length < 8
									? t(
											"salasananOnOltavaVhintn8Merkki",
											"Salasanan on oltava vähintään 8 merkkiä",
										)
									: undefined,
						}}
					>
						{(field) => (
							<div className="space-y-1">
								<label htmlFor={field.name} className={labelClass}>
									{t(
										"uusiSalasanaJtTyhjksiJosEiMuuteta",
										"Uusi salasana (jätä tyhjäksi jos ei muuteta)",
									)}
								</label>
								<Input
									id={field.name}
									type="password"
									autoComplete="new-password"
									value={field.state.value}
									onChange={(e) => field.handleChange(e.target.value)}
									onBlur={field.handleBlur}
									isError={field.state.meta.errors.length > 0}
									placeholder="••••••••"
								/>
								<FieldError errors={field.state.meta.errors} />
							</div>
						)}
					</form.Field>
				</FormSection>

				{updateMe.isError && (
					<p className="text-xs text-red-600 dark:text-red-400">
						{updateMe.error.message}
					</p>
				)}
				{saved && !updateMe.isPending && (
					<output className="block text-xs text-emerald-700 dark:text-emerald-400">
						{t("tiedotTallennettu", "Tiedot tallennettu.")}
					</output>
				)}

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting] as const}
				>
					{([canSubmit, submitting]) => (
						<FormActions
							onCancel={() => {
								form.reset();
								setSaved(false);
							}}
						>
							<Button
								type="submit"
								disabled={!canSubmit || submitting || updateMe.isPending}
								className="gap-2"
							>
								{submitting || updateMe.isPending ? (
									<Loader2 className="animate-spin" size={16} />
								) : null}
								<span>{t("tallennaMuutokset", "Tallenna muutokset")}</span>
							</Button>
						</FormActions>
					)}
				</form.Subscribe>
			</form>

			<FormSection title={t("istunnot", "Istunnot")}>
				<SessionList
					sessions={sessions ?? []}
					onRevoke={(sessionId) => revokeSession.mutate(sessionId)}
					disabled={revokeSession.isPending}
				/>
				{(sessions?.length ?? 0) > 1 && (
					<Button
						variant="outline"
						size="sm"
						disabled={logoutOthers.isPending}
						onClick={() => logoutOthers.mutate()}
					>
						{t("kirjauduUlosMuualta", "Kirjaudu ulos muilta laitteilta")}
					</Button>
				)}
			</FormSection>
		</FormLayout>
	);
}
