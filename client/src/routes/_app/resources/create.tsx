// src/routes/resources/create.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
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
			visibility_group_ids: values.visibility_group_ids,
			reservation_restricted: values.reservation_restricted ?? false,
			group_ids: values.group_ids,
			default_duration_minutes: values.default_duration_minutes || undefined,
			min_duration_minutes: values.min_duration_minutes || undefined,
			max_duration_minutes: values.max_duration_minutes || undefined,
			auto_confirm: values.auto_confirm ?? false,
			auto_confirm_group_ids: values.auto_confirm_group_ids,
			color: values.color || undefined,
			outlook_email: values.outlook_email || undefined,
			reservable_until: values.reservable_until,
			contract_ids: values.contract_ids,
		});
		navigate({ to: "/resources/$id", params: { id: created.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/resources">
						{t("takaisinResursseihin", "Takaisin resursseihin")}
					</BackLink>
				}
				title={t("uusiResurssi", "Uusi resurssi")}
			/>
			<ResourceForm
				onSubmit={handleSubmit}
				onCancel={() => navigate({ to: "/resources" })}
				isSubmitting={createResource.isPending}
				submitLabel={t("luoResurssi", "Luo resurssi")}
			/>
		</FormLayout>
	);
}
