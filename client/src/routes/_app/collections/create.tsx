import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { CollectionForm } from "#/components/CollectionForm";
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
		<div className="p-4 space-y-4">
			<BackLink to="/collections">
				{t("takaisinKokoelmiin", "Takaisin kokoelmiin")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("uusiKokoelma", "Uusi kokoelma")}
			</h1>
			<CollectionForm
				onSubmit={handleSubmit}
				isSubmitting={createCollection.isPending}
				submitLabel={t("luoKokoelma", "Luo kokoelma")}
			/>
		</div>
	);
}
