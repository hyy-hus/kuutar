import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
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
		<div className="space-y-4">
			<BackLink to="/admin/rounds">
				{t("takaisinKierroksiin", "Takaisin varauskierroksiin")}
			</BackLink>
			<h1 className="text-xl font-bold">{t("uusiKierros", "Uusi kierros")}</h1>
			<RoundForm
				submitLabel={t("luoKierros", "Luo kierros")}
				isSubmitting={createRound.isPending}
				error={createRound.error?.message}
				onSubmit={async (values) => {
					const round = await createRound.mutateAsync(values);
					await navigate({ to: "/admin/rounds/$id", params: { id: round.id } });
				}}
			/>
		</div>
	);
}
