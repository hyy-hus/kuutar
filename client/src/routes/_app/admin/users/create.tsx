import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import { UserForm, type UserFormValues } from "#/components/UserForm";
import { useCreateUser } from "#/hooks/useUsers";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/admin/users/create")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateUserPage,
});

function CreateUserPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createUser = useCreateUser();

	const handleSubmit = async (values: UserFormValues) => {
		if (!values.password) return;

		await createUser.mutateAsync({
			name: values.name,
			email: values.email,
			group_id: values.group_id,
			language: values.language,
			password: values.password,
		});

		navigate({ to: "/admin/users" });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/admin/users">
						{t("takaisinKyttjiin", "Takaisin käyttäjiin")}
					</BackLink>
				}
				title={t("rekisteriUusiKyttj", "Rekisteröi uusi käyttäjä")}
			/>
			<UserForm
				onSubmit={handleSubmit}
				isSubmitting={createUser.isPending}
				submitLabel={t("rekisteriKyttj", "Rekisteröi käyttäjä")}
				isCreate={true}
				onCancel={() => navigate({ to: "/admin/users" })}
			/>
		</FormLayout>
	);
}
