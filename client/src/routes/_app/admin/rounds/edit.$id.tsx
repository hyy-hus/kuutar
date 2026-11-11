import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Callout } from "#/components/Callout";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
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
		<FormLayout width="default">
			<PageHeader
				back={
					<BackLink to="/admin/rounds/$id" params={{ id }}>
						{t("takaisinKierrokseen", "Takaisin kierrokseen")}
					</BackLink>
				}
				title={t("muokkaaKierrosta", "Muokkaa kierrosta")}
			/>
			{phase === "completed" ? (
				<Callout variant="info">
					{t(
						"paattynytEiMuokattavissa",
						"Päättynyttä kierrosta ei voi muokata.",
					)}
				</Callout>
			) : (
				<RoundForm
					key={round.id}
					defaultValues={round}
					started={started}
					submitLabel={t("tallenna", "Tallenna")}
					isSubmitting={updateRound.isPending}
					error={updateRound.error?.message}
					onCancel={() => navigate({ to: "/admin/rounds/$id", params: { id } })}
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
		</FormLayout>
	);
}
