import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import { RoundForm } from "#/components/RoundForm";
import { useCreateRound } from "#/hooks/useRounds";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/admin/rounds/create")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateRoundPage,
});

function CreateRoundPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createRound = useCreateRound();

	return (
		<FormLayout width="default">
			<PageHeader
				back={
					<BackLink to="/admin/rounds">
						{t("takaisinKierroksiin", "Takaisin varauskierroksiin")}
					</BackLink>
				}
				title={t("uusiKierros", "Uusi kierros")}
			/>
			<RoundForm
				submitLabel={t("luoKierros", "Luo kierros")}
				isSubmitting={createRound.isPending}
				error={createRound.error?.message}
				onCancel={() => navigate({ to: "/admin/rounds" })}
				onSubmit={async (values) => {
					const round = await createRound.mutateAsync(values);
					await navigate({ to: "/admin/rounds/$id", params: { id: round.id } });
				}}
			/>
		</FormLayout>
	);
}
