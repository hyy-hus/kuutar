import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Callout } from "#/components/Callout";
import { FormLayout } from "#/components/FormLayout";
import { NewsForm } from "#/components/NewsForm";
import { PageHeader } from "#/components/PageHeader";
import { type NewsInput, useNewsItem, useUpdateNews } from "#/hooks/useNews";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/news/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EditNewsPage,
});

function EditNewsPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: item, isLoading } = useNewsItem(id);
	const updateNews = useUpdateNews();

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanTiedotetta", "Ladataan tiedotetta...")}
			</p>
		);
	if (!item)
		return (
			<Callout variant="danger">
				{t("tiedotettaEiLoytynyt", "Tiedotetta ei löytynyt.")}
			</Callout>
		);

	const handleSubmit = async (payload: NewsInput) => {
		await updateNews.mutateAsync({ id, payload });
		navigate({ to: "/news/$id", params: { id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/news/$id" params={{ id }}>
						{t("takaisinTiedotteeseen", "Takaisin tiedotteeseen")}
					</BackLink>
				}
				title={t("muokkaaTiedotetta", "Muokkaa tiedotetta")}
			/>
			<NewsForm
				item={item}
				onSubmit={handleSubmit}
				onCancel={() => navigate({ to: "/news/$id", params: { id } })}
				isSubmitting={updateNews.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</FormLayout>
	);
}
