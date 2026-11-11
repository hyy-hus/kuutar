import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { GroupForm } from "#/components/GroupForm";
import { PageHeader } from "#/components/PageHeader";
import { useGroup, useUpdateGroup } from "#/hooks/useGroups";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/admin/groups/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EditGroupPage,
});

function EditGroupPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: group, isLoading } = useGroup(id);
	const updateGroup = useUpdateGroup();

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanRyhm", "Ladataan ryhmää...")}
			</p>
		);
	if (!group)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ryhmEiLytynyt", "Ryhmää ei löytynyt.")}
			</p>
		);

	const handleSubmit = async (values: { name: string }) => {
		await updateGroup.mutateAsync({
			id: group.id,
			payload: values,
		});
		navigate({ to: "/admin/groups/$id", params: { id: group.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/admin/groups/$id" params={{ id }}>
						{t("takaisinRyhmn", "Takaisin ryhmään")}
					</BackLink>
				}
				title={t("muokkaaRyhm", "Muokkaa ryhmää")}
			/>
			<GroupForm
				defaultValues={{
					name: group.name,
					description: group.description,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateGroup.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
				onCancel={() =>
					navigate({ to: "/admin/groups/$id", params: { id: group.id } })
				}
			/>
		</FormLayout>
	);
}
