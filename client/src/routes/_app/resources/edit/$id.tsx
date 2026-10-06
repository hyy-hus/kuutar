import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import {
	ResourceForm,
	type ResourceFormValues,
} from "#/components/ResourceForm";
import { useContracts } from "#/hooks/useContracts";
import { useResource, useUpdateResource } from "#/hooks/useResorces";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/resources/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
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
				description: values.description,
				// collection_id: values.collection_id,
				allow_recurring: values.allow_recurring,
				blocks_only: values.blocks_only,
				is_public: values.is_public ?? false,
				reservation_restricted: values.reservation_restricted,
				group_ids: values.group_ids,
				// An empty string clears the color
				color: values.color ?? "",
				// An empty string clears the mailbox
				outlook_email: values.outlook_email ?? "",
				reservable_until: values.reservable_until ?? null,
				contract_ids: values.contract_ids,
			},
		});

		navigate({ to: "/resources/$id", params: { id: resource.id } });
	};

	return (
		<div className="p-4 space-y-4 max-w-xl mx-auto">
			<BackLink to="/resources/$id" params={{ id: resourceId }}>
				{t("takaisinResurssiin", "Takaisin resurssiin")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaResurssia", "Muokkaa resurssia")}
			</h1>
			<ResourceForm
				defaultValues={{
					name: resource.name,
					description: resource.description,
					collection_id: resource.collection_id,
					allow_recurring: resource.allow_recurring,
					blocks_only: resource.blocks_only,
					is_public: resource.is_public,
					reservation_restricted: resource.reservation_restricted,
					group_ids: resource.reservable_group_ids,
					color: resource.color,
					outlook_email: resource.outlook_email,
					reservable_until: resource.reservable_until,
					contract_ids: initialContractIds,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateResource.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</div>
	);
}
