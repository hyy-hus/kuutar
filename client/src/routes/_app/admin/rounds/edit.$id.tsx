import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { RoundForm } from "#/components/RoundForm";
import { useRound, useUpdateRound } from "#/hooks/useRounds";
import { requireAdminGuard } from "#/utils/authGuard";
import { roundPhase } from "#/utils/rounds";

export const Route = createFileRoute("/_app/admin/rounds/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EditRoundPage,
});

function EditRoundPage() {
	const { id } = Route.useParams();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { data: round } = useRound(id);
	const updateRound = useUpdateRound();

	if (!round) return <Loader2 className="animate-spin" />;
	const phase = roundPhase(round);
	const started = phase !== "upcoming";

	return (
		<div className="space-y-4">
			<BackLink to="/admin/rounds/$id" params={{ id }}>
				{t("takaisinKierrokseen", "Takaisin kierrokseen")}
			</BackLink>
			<h1 className="text-xl font-bold">
				{t("muokkaaKierrosta", "Muokkaa kierrosta")}
			</h1>
			{phase === "completed" ? (
				<p className="text-sm">
					{t(
						"paattynytEiMuokattavissa",
						"Päättynyttä kierrosta ei voi muokata.",
					)}
				</p>
			) : (
				<RoundForm
					key={round.id}
					defaultValues={round}
					started={started}
					submitLabel={t("tallenna", "Tallenna")}
					isSubmitting={updateRound.isPending}
					error={updateRound.error?.message}
					onSubmit={async (values) => {
						// The server rejects changes to locked fields even when unchanged
						await updateRound.mutateAsync({
							id,
							payload: started
								? {
										name: values.name,
										description: values.description,
										applications_close_at: values.applications_close_at,
									}
								: values,
						});
						await navigate({ to: "/admin/rounds/$id", params: { id } });
					}}
				/>
			)}
		</div>
	);
}
