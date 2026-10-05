import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { RangeSelect } from "#/components/stats/RangeSelect";
import {
	AdminSection,
	MySection,
	OverviewSection,
} from "#/components/stats/Sections";
import { useStats } from "#/hooks/useStats";
import { parseStatsRange, type StatsRange } from "#/utils/statsUtils";

export const Route = createFileRoute("/_app/stats/")({
	validateSearch: (search: Record<string, unknown>) => ({
		range: parseStatsRange(search.range),
	}),
	component: StatsPage,
});

function StatsPage() {
	const { t } = useTranslation();
	const { range } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });
	const { data: stats, isLoading, isError } = useStats(range);

	const setRange = (next: StatsRange) =>
		navigate({ search: { range: next }, replace: true });

	return (
		<div className="flex flex-col min-h-full -m-2 sm:-m-4">
			<div className="flex-1 p-2 sm:p-4 max-w-6xl mx-auto w-full space-y-8 pb-12">
				<div className="flex flex-wrap items-end justify-between gap-4 border-b border-stone-200 dark:border-stone-800 pb-4">
					<div className="space-y-1">
						<h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
							{t("tilastot", "Tilastot")}
						</h1>
						<p className="text-xs text-stone-600 dark:text-stone-400 font-mono">
							{t(
								"tilastoaVaraustenTilanteesta",
								"Tilastoa varausten tilanteesta",
							)}
						</p>
					</div>
					<RangeSelect value={range} onChange={setRange} />
				</div>

				{isLoading ? (
					<div className="p-12 flex flex-col items-center justify-center gap-3 text-stone-500">
						<Loader2 className="animate-spin" size={24} />
						<span className="text-xs font-mono">
							{t("ladataanTilastoja", "Ladataan tilastoja...")}
						</span>
					</div>
				) : isError || !stats ? (
					<div className="p-6 border-2 border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 rounded-md text-xs font-mono text-rose-800 dark:text-rose-300 flex items-center gap-2">
						<AlertCircle size={16} />
						<span>
							{t(
								"tilastojenLataaminenEponnistuiYritMyhemminUudelleen",
								"Tilastojen lataaminen epäonnistui. Yritä myöhemmin uudelleen.",
							)}
						</span>
					</div>
				) : (
					<>
						<OverviewSection stats={stats.public} />
						{stats.me && <MySection stats={stats.me} />}
						{stats.admin && <AdminSection stats={stats.admin} />}
					</>
				)}
			</div>
		</div>
	);
}
