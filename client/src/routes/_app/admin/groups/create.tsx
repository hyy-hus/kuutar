import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { GroupForm } from "#/components/GroupForm";
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
		<div className="p-4 space-y-4">
			<BackLink to="/admin/groups">
				{t("takaisinRyhmiin", "Takaisin ryhmiin")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("uusiRyhm", "Uusi ryhmä")}
			</h1>
			<GroupForm
				onSubmit={handleSubmit}
				isSubmitting={createGroup.isPending}
				submitLabel={t("luoRyhma", "Luo ryhmä")}
			/>
		</div>
	);
}
