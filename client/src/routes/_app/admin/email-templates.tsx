import { createFileRoute } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Callout } from "#/components/Callout";
import { EmailTemplateEditor } from "#/components/EmailTemplateEditor";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { SegmentedControl } from "#/components/SegmentedControl";
import {
	type EmailTemplateKey,
	useEmailTemplates,
} from "#/hooks/useEmailTemplates";
import { requireAdminGuard } from "#/utils/authGuard";

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
			<div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataan", "Ladataan...")}</span>
			</div>
		);
	}

	if (isError || !templates) {
		return (
			<Callout variant="danger">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</Callout>
		);
	}

	const template = templates.find((item) => item.key === selected);

	return (
		<PageContainer>
			<PageHeader
				title={t("sahkopostipohjat", "Sähköpostipohjat")}
				subtitle={t(
					"sahkopostipohjatKuvaus",
					"Muokkaa automaattisesti lähetettäviä sähköposteja. Käyttäjä saa viestin omalla kielellään.",
				)}
			/>

			<div className="space-y-2">
				<SegmentedControl
					role="tablist"
					aria-label={t("sahkopostipohja", "Sähköpostipohja")}
					className="max-w-full overflow-x-auto"
					value={selected}
					onChange={setSelected}
					options={templates.map((item) => ({
						value: item.key,
						label: names[item.key].title,
						dot: item.customized,
					}))}
				/>
				{template && (
					<p className="text-xs text-stone-600 dark:text-stone-400">
						{names[template.key].hint}
					</p>
				)}
			</div>

			{template && (
				/* Remount after save/reset so the editor resyncs with the stored version */
				<EmailTemplateEditor
					key={`${template.key}-${template.updated_at ?? "default"}`}
					template={template}
				/>
			)}
		</PageContainer>
	);
}
