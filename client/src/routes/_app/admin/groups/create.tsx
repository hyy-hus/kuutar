import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { GroupForm } from "#/components/GroupForm";
import { PageHeader } from "#/components/PageHeader";
import { useCreateGroup } from "#/hooks/useGroups";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/admin/groups/create")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateGroupPage,
});

function CreateGroupPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createGroup = useCreateGroup();

	const handleSubmit = async (values: { name: string }) => {
		const created = await createGroup.mutateAsync(values);
		navigate({ to: "/admin/groups/$id", params: { id: created.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/admin/groups">
						{t("takaisinRyhmiin", "Takaisin ryhmiin")}
					</BackLink>
				}
				title={t("uusiRyhm", "Uusi ryhmä")}
			/>
			<GroupForm
				onSubmit={handleSubmit}
				isSubmitting={createGroup.isPending}
				submitLabel={t("luoRyhma", "Luo ryhmä")}
				onCancel={() => navigate({ to: "/admin/groups" })}
			/>
		</FormLayout>
	);
}
