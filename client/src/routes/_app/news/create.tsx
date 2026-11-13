import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { NewsForm } from "#/components/NewsForm";
import { PageHeader } from "#/components/PageHeader";
import { type NewsInput, useCreateNews } from "#/hooks/useNews";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/news/create")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateNewsPage,
});

function CreateNewsPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createNews = useCreateNews();

	const handleSubmit = async (payload: NewsInput) => {
		const created = await createNews.mutateAsync(payload);
		navigate({ to: "/news/$id", params: { id: created.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/news">
						{t("takaisinTiedotteisiin", "Takaisin tiedotteisiin")}
					</BackLink>
				}
				title={t("uusiTiedote", "Uusi tiedote")}
			/>
			<NewsForm
				onSubmit={handleSubmit}
				onCancel={() => navigate({ to: "/news" })}
				isSubmitting={createNews.isPending}
				submitLabel={t("luoTiedote", "Luo tiedote")}
			/>
		</FormLayout>
	);
}
