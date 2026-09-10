import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { UserForm, type UserFormValues } from "#/components/UserForm";
import { useUpdateUser, useUser } from "#/hooks/useUsers";
import { requireAuthGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/users/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
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
			<div className="p-4">{t("ladataanKyttj", "Ladataan käyttäjää...")}</div>
		);
	if (!user)
		return (
			<div className="p-4">{t("kyttjEiLytynyt", "Käyttäjää ei löytynyt.")}</div>
		);

	const handleSubmit = async (values: UserFormValues) => {
		await updateUser.mutateAsync({
			id: user.id,
			payload: {
				email: values.email,
				group_id: values.group_id,
				...(values.password ? { password: values.password } : {}),
			},
		});
		navigate({ to: "/users/$id", params: { id: user.id } });
	};

	return (
		<div className="p-4 space-y-4">
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaKyttj", "Muokkaa käyttäjää")}
			</h1>
			<UserForm
				defaultValues={{
					email: user.email,
					group_id: user.group_id,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateUser.isPending}
				submitLabel="Tallenna muutokset"
				isCreate={false}
			/>
		</div>
	);
}
