import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { type Round, useRounds } from "#/hooks/useRounds";
import { requireAdminGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import { roundPhase } from "#/utils/rounds";

const DASH = " – ";

export const Route = createFileRoute("/_app/admin/rounds/")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: RoundsPage,
});

export function RoundPhaseChip({ round }: { round: Round }) {
	const { t } = useTranslation();
	const phase = roundPhase(round);
	const labels = {
		upcoming: t("kierrosTulossa", "Tulossa"),
		open: t("kierrosAvoinna", "Haku käynnissä"),
		allocating: t("kierrosJaossa", "Odottaa jakoa"),
		completed: t("kierrosPttynyt", "Päättynyt"),
	} as const;
	return <Chip>{labels[phase]}</Chip>;
}

function RoundsPage() {
	const { t } = useTranslation();
	const { formatDate, formatDateOnly } = useDateFormatter();
	const { data: rounds, isLoading } = useRounds();

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between gap-2">
				<h1 className="text-xl font-bold">
					{t("varauskierrokset", "Varauskierrokset")}
				</h1>
				<Button asChild size="sm" className="gap-1.5">
					<Link to="/admin/rounds/create">
						<Plus size={14} />
						<span>{t("uusiKierros", "Uusi kierros")}</span>
					</Link>
				</Button>
			</div>
			{isLoading && <Loader2 className="animate-spin" />}
			{rounds?.length === 0 && (
				<p className="text-sm text-stone-500">
					{t("eiVarauskierroksia", "Ei varauskierroksia.")}
				</p>
			)}
			<ul className="space-y-2">
				{rounds?.map((round) => (
					<li
						key={round.id}
						className="p-3 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900 flex items-center justify-between gap-3"
					>
						<div className="min-w-0 space-y-1">
							<div className="flex items-center gap-2">
								<h2 className="font-bold truncate">{round.name}</h2>
								<RoundPhaseChip round={round} />
							</div>
							<p className="text-xs text-stone-600 dark:text-stone-400">
								{`${t("hakuaika", "Hakuaika")}: `}
								{formatDate(round.applications_open_at)}
								{DASH}
								{formatDate(round.applications_close_at)}
							</p>
							<p className="text-xs text-stone-600 dark:text-stone-400">
								{`${t("kierroksenAjanjakso", "Varattava ajanjakso")}: `}
								{formatDateOnly(round.period_start)}
								{DASH}
								{formatDateOnly(round.period_end)}
							</p>
						</div>
						<Button variant="secondary" size="sm" asChild className="gap-1.5">
							<Link to="/admin/rounds/$id" params={{ id: round.id }}>
								<span>{t("nyt", "Näytä")}</span>
								<Eye size={14} />
							</Link>
						</Button>
					</li>
				))}
			</ul>
		</div>
	);
}
