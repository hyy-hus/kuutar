import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus, ShieldAlert } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { Chip } from "#/components/Chip";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { FilterBar } from "#/components/FilterBar";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { PeriodNavigator } from "#/components/PeriodNavigator";
import { Select } from "#/components/Select";
import { useIsAdmin } from "#/hooks/useAuth";
import { useGroups } from "#/hooks/useGroups";
import { useResources } from "#/hooks/useResorces";
import {
	type RestrictionWithOccurrences,
	useRestrictions,
} from "#/hooks/useRestrictions";
import { requireAuthGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import {
	getPeriodRange,
	type PeriodMonths,
	parsePeriodMonths,
} from "#/utils/period";

export interface RestrictionsDashboardSearch {
	start_date?: string;
	months?: PeriodMonths;
	resource_id?: string;
}

export const Route = createFileRoute("/_app/restrictions/")({
	validateSearch: (
		search: Record<string, unknown>,
	): RestrictionsDashboardSearch => ({
		start_date:
			typeof search.start_date === "string" ? search.start_date : undefined,
		months: parsePeriodMonths(search.months),
		resource_id:
			typeof search.resource_id === "string" ? search.resource_id : undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: RestrictionsDashboardPage,
});

function RestrictionCard({ item }: { item: RestrictionWithOccurrences }) {
	const { t } = useTranslation();
	const { formatRange } = useDateFormatter();
	const { data: groups } = useGroups();

	const groupMap = useMemo(
		() => new Map(groups?.map((g) => [g.id, g.name])),
		[groups],
	);

	const occurrences = item.occurrences || [];
	const firstOcc = occurrences[0];

	// No exempt groups is the default (restriction applies to everyone), so only show exceptions
	const exemptGroupNames = item.exempt_group_ids.map(
		(gId) => groupMap.get(gId) || gId,
	);

	return (
		<EntityCard
			to="/restrictions/$id"
			params={{ id: item.id }}
			title={item.title}
			icon={ShieldAlert}
			meta={
				firstOcc
					? [
							formatRange(firstOcc.start_time, firstOcc.end_time),
							occurrences.length > 1
								? t("varausjaksonAjatMaara", "{{count}} aikaa", {
										count: occurrences.length,
									})
								: null,
						]
							.filter(Boolean)
							.join(" · ")
					: t("eiAikoja", "Ei aikoja")
			}
			description={item.description ?? undefined}
			badges={
				exemptGroupNames.length > 0 && (
					<Chip title={exemptGroupNames.join(", ")}>
						{t("sallittuRyhmaN", "Sallitut ryhmät: {{names}}", {
							names: exemptGroupNames.join(", "),
						})}
					</Chip>
				)
			}
		/>
	);
}

function RestrictionsDashboardPage() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { isAdmin } = useIsAdmin();

	const { data: resources, isLoading: loadingResources } = useResources();

	const months = search.months ?? 1;
	const resourceId = search.resource_id;
	const {
		start,
		startDateISO: startISO,
		endDateISO: endISO,
	} = useMemo(
		() => getPeriodRange(search.start_date, months),
		[search.start_date, months],
	);

	const {
		data: restrictions,
		isLoading,
		isError,
	} = useRestrictions({
		start_date: startISO,
		end_date: endISO,
		resource_id: resourceId,
	});

	const updateSearch = (next: RestrictionsDashboardSearch) => {
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	};

	return (
		<PageContainer>
			<PageHeader
				title={t("rajoitukset", "Rajoitukset")}
				subtitle={
					!isLoading && !isError
						? t(
								"voimassaOlevatRajoitukset",
								"Voimassa olevat rajoitukset ({{count}})",
								{ count: restrictions?.length ?? 0 },
							)
						: undefined
				}
				actions={
					isAdmin && (
						<Button asChild>
							<Link to="/restrictions/create">
								<Plus size={16} />
								{t("uusiRajoitus", "Uusi rajoitus")}
							</Link>
						</Button>
					)
				}
			/>

			<FilterBar>
				<PeriodNavigator
					start={start}
					months={months}
					onChange={updateSearch}
				/>
				<Select
					size="sm"
					wrapperClassName="w-auto max-w-full"
					aria-label={t("resurssi", "Resurssi")}
					value={resourceId || ""}
					onChange={(e) =>
						updateSearch({ resource_id: e.target.value || undefined })
					}
					disabled={loadingResources}
				>
					<option value="">{t("kaikkiResurssit", "Kaikki resurssit")}</option>
					{resources?.map((res) => (
						<option key={res.id} value={res.id}>
							{res.name}
						</option>
					))}
				</Select>
			</FilterBar>

			{isLoading ? (
				<div className="flex items-center justify-center gap-2 p-8 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} />
					<span>{t("ladataanRajoituksia", "Ladataan rajoituksia...")}</span>
				</div>
			) : isError ? (
				<Callout variant="danger">
					{t("virheLadattaessaRajoituksia", "Virhe ladattaessa rajoituksia.")}
				</Callout>
			) : restrictions && restrictions.length > 0 ? (
				<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{restrictions.map((res) => (
						<li key={res.id} className="min-w-0 *:h-full">
							<RestrictionCard item={res} />
						</li>
					))}
				</ul>
			) : (
				<EmptyState
					icon={ShieldAlert}
					title={t(
						"eiRajoituksiaValitullaAikavlill",
						"Ei aktiivisia aikarajoituksia valitulla aikavälillä.",
					)}
				/>
			)}
		</PageContainer>
	);
}
