import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { PHASE_ORDER, RoundPhaseChip } from "#/components/RoundPhaseChip";
import { useRounds } from "#/hooks/useRounds";
import { requireAdminGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import { roundPhase } from "#/utils/rounds";

export const Route = createFileRoute("/_app/admin/rounds/")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: RoundsPage,
});

function RoundsPage() {
	const { t } = useTranslation();
	const { formatRange, formatDateOnly } = useDateFormatter();
	const { data: rounds, isLoading } = useRounds();

	// Active rounds first, then newest application window first
	const sorted = [...(rounds ?? [])].sort(
		(a, b) =>
			PHASE_ORDER[roundPhase(a)] - PHASE_ORDER[roundPhase(b)] ||
			b.applications_open_at.localeCompare(a.applications_open_at),
	);

	return (
		<PageContainer>
			<PageHeader
				title={t("varauskierrokset", "Varauskierrokset")}
				subtitle={
					rounds && rounds.length > 0
						? t("kierroksiaMaara", "Kierroksia: {{count}}", {
								count: rounds.length,
							})
						: undefined
				}
				actions={
					<Button asChild className="gap-1.5">
						<Link to="/admin/rounds/create">
							<Plus size={16} />
							<span>{t("uusiKierros", "Uusi kierros")}</span>
						</Link>
					</Button>
				}
			/>
			{isLoading && <Loader2 className="animate-spin" />}
			{rounds?.length === 0 && (
				<EmptyState title={t("eiVarauskierroksia", "Ei varauskierroksia.")} />
			)}
			<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{sorted.map((round) => (
					<li key={round.id} className="flex">
						<EntityCard
							className="w-full"
							to="/admin/rounds/$id"
							params={{ id: round.id }}
							title={round.name}
							meta={
								<span className="flex flex-col gap-0.5 tabular-nums">
									<span>
										{`${t("hakuaika", "Hakuaika")}: ${formatRange(round.applications_open_at, round.applications_close_at)}`}
									</span>
									<span>
										{`${t("kierroksenAjanjakso", "Varattava ajanjakso")}: ${formatDateOnly(round.period_start)} – ${formatDateOnly(round.period_end)}`}
									</span>
								</span>
							}
							description={round.description ?? undefined}
							badges={<RoundPhaseChip round={round} />}
						/>
					</li>
				))}
			</ul>
		</PageContainer>
	);
}
