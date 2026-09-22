import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
	ResourceForm,
	type ResourceFormValues,
} from "#/components/ResourceForm";
import { useContracts } from "#/hooks/useContracts";
import { useResource, useUpdateResource } from "#/hooks/useResorces";
import { requireAuthGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/resources/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: EditResourcePage,
});

function EditResourcePage() {
	const { t } = useTranslation();
	const { id: resourceId } = Route.useParams();
	const navigate = useNavigate();

	const { data: resource, isLoading: loadingResource } =
		useResource(resourceId);

	// Fetch ONLY contracts bound to this specific resource
	const { data: resourceContracts, isLoading: loadingContracts } = useContracts(
		{
			resource_id: resourceId,
			active_only: true,
		},
	);

	const updateResource = useUpdateResource();

	if (loadingResource || loadingContracts) {
		return (
			<div className="p-4">
				{t("ladataanResurssia", "Ladataan resurssia...")}
			</div>
		);
	}

	if (!resource) {
		return (
			<div className="p-4">
				{t("resurssiaEiLytynyt", "Resurssia ei löytynyt.")}
			</div>
		);
	}

	// Filter out global contracts to get only explicitly linked contract IDs
	const initialContractIds =
		resourceContracts?.filter((c) => !c.is_global).map((c) => c.id) ?? [];

	const handleSubmit = async (values: ResourceFormValues) => {
		await updateResource.mutateAsync({
			id: resource.id,
			payload: {
				name: values.name,
				collection_id: values.collection_id,
				allow_recurring: values.allow_recurring,
				contract_ids: values.contract_ids,
			},
		});

		navigate({ to: "/resources/$id", params: { id: resource.id } });
	};

	return (
		<div className="p-4 space-y-4 max-w-xl mx-auto">
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaResurssia", "Muokkaa resurssia")}
			</h1>
			<ResourceForm
				defaultValues={{
					name: resource.name,
					collection_id: resource.collection_id,
					allow_recurring: resource.allow_recurring,
					contract_ids: initialContractIds,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateResource.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</div>
	);
}
