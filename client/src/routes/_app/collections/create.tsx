import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { CollectionForm } from "#/components/CollectionForm";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import { useCreateCollection } from "#/hooks/useCollections";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/collections/create")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateCollectionPage,
});

function CreateCollectionPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createCollection = useCreateCollection();

	const handleSubmit = async (values: { name: string }) => {
		const created = await createCollection.mutateAsync(values);
		navigate({ to: "/collections/$id", params: { id: created.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/collections">
						{t("takaisinKokoelmiin", "Takaisin kokoelmiin")}
					</BackLink>
				}
				title={t("uusiKokoelma", "Uusi kokoelma")}
			/>
			<CollectionForm
				onSubmit={handleSubmit}
				onCancel={() => navigate({ to: "/collections" })}
				isSubmitting={createCollection.isPending}
				submitLabel={t("luoKokoelma", "Luo kokoelma")}
			/>
		</FormLayout>
	);
}
