import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { CollectionForm } from "#/components/CollectionForm";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import { useCollection, useUpdateCollection } from "#/hooks/useCollections";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/collections/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EditCollectionPage,
});

function EditCollectionPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: collection, isLoading } = useCollection(id);
	const updateCollection = useUpdateCollection();

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanKokoelmaa", "Ladataan kokoelmaa...")}
			</p>
		);
	if (!collection)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("kokoelmaaEiLytynyt", "Kokoelmaa ei löytynyt.")}
			</p>
		);

	const handleSubmit = async (values: { name: string }) => {
		await updateCollection.mutateAsync({
			id: collection.id,
			payload: values,
		});
		navigate({ to: "/collections/$id", params: { id: collection.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/collections/$id" params={{ id }}>
						{t("takaisinKokoelmaan", "Takaisin kokoelmaan")}
					</BackLink>
				}
				title={t("muokkaaKokoelmaa", "Muokkaa kokoelmaa")}
			/>
			<CollectionForm
				defaultValues={{
					name: collection.name,
					description: collection.description,
					icon: collection.icon,
				}}
				onSubmit={handleSubmit}
				onCancel={() =>
					navigate({ to: "/collections/$id", params: { id: collection.id } })
				}
				isSubmitting={updateCollection.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</FormLayout>
	);
}
