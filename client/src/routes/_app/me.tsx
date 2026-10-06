import { useForm } from "@tanstack/react-form";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Save } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Input } from "#/components/Input";
import { LanguageSelect } from "#/components/LanguageSelect";
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
	return <p className="text-[11px] text-red-500">{errors.join(", ")}</p>;
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

	const labelClass = "text-xs font-medium text-stone-700 dark:text-stone-300";

	return (
		<div className="p-4 space-y-4 max-w-md">
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("omatTiedot", "Omat tiedot")}
			</h1>

			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="space-y-4"
			>
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
							<p className="text-[11px] text-stone-500">
								{t(
									"kieliKuvausSahkoposti",
									"Käyttäjän sähköpostiviestit lähetetään tällä kielellä.",
								)}
							</p>
						</div>
					)}
				</form.Field>

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

				<div className="p-3 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md space-y-3">
					<div>
						<h2 className="text-xs font-bold text-purple-700 dark:text-purple-400">
							{t("oletusyhteystiedot", "Oletusyhteystiedot")}
						</h2>
						<p className="text-[11px] text-stone-600 dark:text-stone-400">
							{t(
								"oletusyhteystiedotKuvaus",
								"Näillä tiedoilla täytetään uusien varausten yhteystiedot automaattisesti.",
							)}
						</p>
					</div>

					<form.Field name="default_contact_person">
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
								/>
							</div>
						)}
					</form.Field>

					<div className="grid grid-cols-2 gap-2">
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
									/>
								</div>
							)}
						</form.Field>
					</div>
				</div>

				{updateMe.isError && (
					<p className="text-xs text-red-500">{updateMe.error.message}</p>
				)}
				{saved && !updateMe.isPending && (
					<p className="text-xs text-emerald-600 dark:text-emerald-400">
						{t("tiedotTallennettu", "Tiedot tallennettu.")}
					</p>
				)}

				<form.Subscribe
					selector={(state) => [state.canSubmit, state.isSubmitting] as const}
				>
					{([canSubmit, submitting]) => (
						<Button
							type="submit"
							disabled={!canSubmit || submitting || updateMe.isPending}
							className="w-full flex items-center justify-center gap-2"
						>
							{submitting || updateMe.isPending ? (
								<Loader2 className="animate-spin" size={16} />
							) : (
								<>
									<Save size={16} />
									<span>{t("tallennaMuutokset", "Tallenna muutokset")}</span>
								</>
							)}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<section className="space-y-2 pt-4 border-t border-stone-200 dark:border-stone-800">
				<h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
					{t("aktiivisetIstunnot", "Aktiiviset istunnot")}
				</h2>
				<SessionList
					sessions={sessions ?? []}
					onRevoke={(sessionId) => revokeSession.mutate(sessionId)}
					disabled={revokeSession.isPending}
				/>
				{(sessions?.length ?? 0) > 1 && (
					<Button
						variant="outline"
						size="sm"
						className="w-full"
						disabled={logoutOthers.isPending}
						onClick={() => logoutOthers.mutate()}
					>
						{t("kirjauduUlosMuualta", "Kirjaudu ulos muilta laitteilta")}
					</Button>
				)}
			</section>
		</div>
	);
}
