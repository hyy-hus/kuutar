// src/routes/resources/create.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import {
	ResourceForm,
	type ResourceFormValues,
} from "#/components/ResourceForm";
import { useCreateResource } from "#/hooks/useResorces";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/resources/create")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateResourcePage,
});

function CreateResourcePage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createResource = useCreateResource();

	const handleSubmit = async (values: ResourceFormValues) => {
		const created = await createResource.mutateAsync({
			name: values.name,
			description: values.description,
			collection_id: values.collection_id,
			allow_recurring: values.allow_recurring ?? true,
			blocks_only: values.blocks_only ?? false,
			is_public: values.is_public ?? true,
			reservation_restricted: values.reservation_restricted ?? false,
			group_ids: values.group_ids,
			reservable_until: values.reservable_until,
			contract_ids: values.contract_ids,
		});
		navigate({ to: "/resources/$id", params: { id: created.id } });
	};

	return (
		<div className="p-4 space-y-4">
			<BackLink to="/resources">
				{t("takaisinResursseihin", "Takaisin resursseihin")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("uusiResurssi", "Uusi resurssi")}
			</h1>
			<ResourceForm
				onSubmit={handleSubmit}
				isSubmitting={createResource.isPending}
				submitLabel={t("luoResurssi", "Luo resurssi")}
			/>
		</div>
	);
}
