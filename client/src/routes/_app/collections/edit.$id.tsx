import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { CollectionForm } from "#/components/CollectionForm";
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
			<div className="p-4">
				{t("ladataanKokoelmaa", "Ladataan kokoelmaa...")}
			</div>
		);
	if (!collection)
		return (
			<div className="p-4">
				{t("kokoelmaaEiLytynyt", "Kokoelmaa ei löytynyt.")}
			</div>
		);

	const handleSubmit = async (values: { name: string }) => {
		await updateCollection.mutateAsync({
			id: collection.id,
			payload: values,
		});
		navigate({ to: "/collections/$id", params: { id: collection.id } });
	};

	return (
		<div className="p-4 space-y-4">
			<BackLink to="/collections/$id" params={{ id }}>
				{t("takaisinKokoelmaan", "Takaisin kokoelmaan")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaKokoelmaa", "Muokkaa kokoelmaa")}
			</h1>
			<CollectionForm
				defaultValues={{
					name: collection.name,
					description: collection.description,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateCollection.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</div>
	);
}
