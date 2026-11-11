import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import { UserForm, type UserFormValues } from "#/components/UserForm";
import { useUpdateUser, useUser } from "#/hooks/useUsers";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/admin/users/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EditUserPage,
});

function EditUserPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: user, isLoading } = useUser(id);
	const updateUser = useUpdateUser();

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanKyttj", "Ladataan käyttäjää...")}
			</p>
		);
	if (!user)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("kyttjEiLytynyt", "Käyttäjää ei löytynyt.")}
			</p>
		);

	const handleSubmit = async (values: UserFormValues) => {
		await updateUser.mutateAsync({
			id: user.id,
			payload: {
				name: values.name,
				email: values.email,
				group_id: values.group_id,
				language: values.language,
				...(values.password ? { password: values.password } : {}),
			},
		});
		navigate({ to: "/admin/users/$id", params: { id: user.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/admin/users/$id" params={{ id }}>
						{t("takaisinKyttjn", "Takaisin käyttäjään")}
					</BackLink>
				}
				title={t("muokkaaKyttj", "Muokkaa käyttäjää")}
			/>
			<UserForm
				defaultValues={{
					name: user.name,
					email: user.email,
					group_id: user.group_id,
					language: user.language,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateUser.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
				isCreate={false}
				onCancel={() =>
					navigate({ to: "/admin/users/$id", params: { id: user.id } })
				}
			/>
		</FormLayout>
	);
}
