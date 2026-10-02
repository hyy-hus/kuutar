import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { GroupForm } from "#/components/GroupForm";
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
		return <div className="p-4">{t("ladataanRyhm", "Ladataan ryhmää...")}</div>;
	if (!group)
		return (
			<div className="p-4">{t("ryhmEiLytynyt", "Ryhmää ei löytynyt.")}</div>
		);

	const handleSubmit = async (values: { name: string }) => {
		await updateGroup.mutateAsync({
			id: group.id,
			payload: values,
		});
		navigate({ to: "/admin/groups/$id", params: { id: group.id } });
	};

	return (
		<div className="p-4 space-y-4">
			<BackLink to="/admin/groups/$id" params={{ id }}>
				{t("takaisinRyhmn", "Takaisin ryhmään")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaRyhm", "Muokkaa ryhmää")}
			</h1>
			<GroupForm
				defaultValues={{
					name: group.name,
					description: group.description,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateGroup.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</div>
	);
}
