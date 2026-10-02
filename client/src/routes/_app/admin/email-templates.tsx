import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Mail } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmailTemplateEditor } from "#/components/EmailTemplateEditor";
import {
	type EmailTemplateKey,
	useEmailTemplates,
} from "#/hooks/useEmailTemplates";
import { requireAdminGuard } from "#/utils/authGuard";
import { cn } from "#/utils/cn";

export const Route = createFileRoute("/_app/admin/email-templates")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EmailTemplatesPage,
});

function EmailTemplatesPage() {
	const { t } = useTranslation();
	const { data: templates, isLoading, isError } = useEmailTemplates();
	const [selected, setSelected] = useState<EmailTemplateKey>(
		"reservation_created",
	);

	const names: Record<EmailTemplateKey, { title: string; hint: string }> = {
		reservation_created: {
			title: t("varausVastaanotettu", "Varaus vastaanotettu"),
			hint: t(
				"varausVastaanotettuKuvaus",
				"Lähetetään, kun varaus on tehty ja odottaa hyväksyntää.",
			),
		},
		reservation_confirmed: {
			title: t("varausVahvistettu", "Varaus vahvistettu"),
			hint: t(
				"varausVahvistettuKuvaus",
				"Lähetetään, kun varaus vahvistetaan.",
			),
		},
		reservation_cancelled: {
			title: t("varausPeruttu", "Varaus peruttu"),
			hint: t("varausPeruttuKuvaus", "Lähetetään, kun varaus perutaan."),
		},
		user_welcome: {
			title: t("tervetuloaViesti", "Tervetuloa-viesti"),
			hint: t(
				"tervetuloaViestiKuvaus",
				"Lähetetään uudelle käyttäjälle tilin luomisen jälkeen.",
			),
		},
	};

	if (isLoading) {
		return (
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataan", "Ladataan...")}</span>
			</div>
		);
	}

	if (isError || !templates) {
		return (
			<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</div>
		);
	}

	const template = templates.find((item) => item.key === selected);

	return (
		<div className="flex flex-col gap-4 p-2 sm:p-4 min-w-0">
			<div className="border-b border-stone-200 dark:border-stone-800 pb-3">
				<h1 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
					<Mail size={20} className="text-stone-500" />
					<span>{t("sahkopostipohjat", "Sähköpostipohjat")}</span>
				</h1>
				<p className="text-xs text-stone-500">
					{t(
						"sahkopostipohjatKuvaus",
						"Muokkaa automaattisesti lähetettävien sähköpostien sisältöä. Käyttäjä saa viestin omalla kielellään.",
					)}
				</p>
			</div>

			<div role="tablist" className="flex flex-wrap gap-2">
				{templates.map((item) => (
					<button
						key={item.key}
						type="button"
						role="tab"
						aria-selected={item.key === selected}
						onClick={() => setSelected(item.key)}
						className={cn(
							"px-3 py-1.5 text-xs font-medium rounded-md border-2 transition-colors flex items-center gap-1.5",
							item.key === selected
								? "bg-stone-800 text-white border-stone-800 dark:bg-stone-200 dark:text-stone-900 dark:border-stone-200"
								: "border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800",
						)}
					>
						{names[item.key].title}
						{item.customized && (
							<span
								role="img"
								aria-label={t("muokattu", "Muokattu")}
								title={t("muokattu", "Muokattu")}
								className="w-1.5 h-1.5 rounded-full bg-emerald-500"
							/>
						)}
					</button>
				))}
			</div>

			{template && (
				<>
					<p className="text-xs text-stone-600 dark:text-stone-400">
						{names[template.key].hint}
					</p>
					{/* Remount after save/reset so the editor resyncs with the stored version */}
					<EmailTemplateEditor
						key={`${template.key}-${template.updated_at ?? "default"}`}
						template={template}
					/>
				</>
			)}
		</div>
	);
}
