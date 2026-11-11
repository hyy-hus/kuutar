import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Callout } from "#/components/Callout";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
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
		<PageContainer>
			<PageHeader
				title={t("tilastot", "Tilastot")}
				subtitle={t(
					"tilastoaVaraustenTilanteesta",
					"Tilastoa varausten tilanteesta",
				)}
				actions={<RangeSelect value={range} onChange={setRange} />}
			/>

			{isLoading ? (
				<output className="p-12 flex flex-col items-center justify-center gap-3 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={24} />
					<span className="text-sm">
						{t("ladataanTilastoja", "Ladataan tilastoja...")}
					</span>
				</output>
			) : isError || !stats ? (
				<Callout variant="danger">
					{t(
						"tilastojenLataaminenEponnistuiYritMyhemminUudelleen",
						"Tilastojen lataaminen epäonnistui. Yritä myöhemmin uudelleen.",
					)}
				</Callout>
			) : (
				<>
					<OverviewSection stats={stats.public} />
					{stats.me && <MySection stats={stats.me} />}
					{stats.admin && <AdminSection stats={stats.admin} />}
				</>
			)}
		</PageContainer>
	);
}
