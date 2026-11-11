import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarCheck, Loader2, Plus } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { Chip } from "#/components/Chip";
import { EntityCard } from "#/components/EntityCard";
import { FilterBar } from "#/components/FilterBar";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { PeriodEmptyState } from "#/components/PeriodEmptyState";
import { PeriodNavigator } from "#/components/PeriodNavigator";
import { Select } from "#/components/Select";
import { useIsAdmin } from "#/hooks/useAuth";
import {
	type ReservableBlockWithOccurrences,
	useReservableBlocks,
} from "#/hooks/useReservableBlocks";
import { useResources } from "#/hooks/useResorces";
import { requireAuthGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import {
	getPeriodRange,
	type PeriodMonths,
	parsePeriodMonths,
} from "#/utils/period";

export interface ReservableBlocksSearch {
	start_date?: string;
	months?: PeriodMonths;
	resource_id?: string;
}

export const Route = createFileRoute("/_app/reservable-blocks/")({
	validateSearch: (
		search: Record<string, unknown>,
	): ReservableBlocksSearch => ({
		start_date:
			typeof search.start_date === "string" ? search.start_date : undefined,
		months: parsePeriodMonths(search.months),
		resource_id:
			typeof search.resource_id === "string" ? search.resource_id : undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: ReservableBlocksPage,
});

const MAX_RESOURCE_BADGES = 3;

function BlockCard({
	item,
	resourceNames,
}: {
	item: ReservableBlockWithOccurrences;
	resourceNames: Map<string, string>;
}) {
	const { t } = useTranslation();
	const { formatRange } = useDateFormatter();

	const firstOcc = item.occurrences[0];
	const resources = Array.from(
		new Set(
			item.occurrences.map(
				(o) => resourceNames.get(o.resource_id) ?? o.resource_id,
			),
		),
	);
	const shownResources = resources.slice(0, MAX_RESOURCE_BADGES);
	const hiddenCount = resources.length - shownResources.length;

	return (
		<EntityCard
			to="/reservable-blocks/$id"
			params={{ id: item.id }}
			title={item.title}
			icon={CalendarCheck}
			meta={
				firstOcc
					? [
							formatRange(firstOcc.start_time, firstOcc.end_time),
							item.occurrences.length > 1
								? t("varausjaksonAjatMaara", "{{count}} aikaa", {
										count: item.occurrences.length,
									})
								: null,
						]
							.filter(Boolean)
							.join(" · ")
					: t("eiAikoja", "Ei aikoja")
			}
			description={item.description ?? undefined}
			badges={
				resources.length > 0 && (
					<>
						{shownResources.map((name) => (
							<Chip key={name}>{name}</Chip>
						))}
						{hiddenCount > 0 && <Chip>{`+${hiddenCount}`}</Chip>}
					</>
				)
			}
		/>
	);
}

function ReservableBlocksPage() {
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
		data: blocks,
		isLoading,
		isError,
	} = useReservableBlocks({
		start_date: startISO,
		end_date: endISO,
		resource_id: resourceId,
	});

	const resourceNames = useMemo(
		() => new Map(resources?.map((r) => [r.id, r.name])),
		[resources],
	);
	const blockResources = resources?.filter((r) => r.blocks_only);

	const updateSearch = (next: ReservableBlocksSearch) => {
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	};

	return (
		<PageContainer>
			<PageHeader
				title={t("varausjaksot", "Varausjaksot")}
				subtitle={
					!isLoading && !isError
						? t("varausjaksoja", "Varausjaksoja ({{count}})", {
								count: blocks?.length ?? 0,
							})
						: undefined
				}
				actions={
					isAdmin && (
						<Button asChild>
							<Link to="/reservable-blocks/create">
								<Plus size={16} />
								{t("uusiVarausjakso", "Uusi varausjakso")}
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
					{blockResources?.map((res) => (
						<option key={res.id} value={res.id}>
							{res.name}
						</option>
					))}
				</Select>
			</FilterBar>

			{isLoading ? (
				<div className="flex items-center justify-center gap-2 p-8 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} />
					<span>{t("ladataanVarausjaksoja", "Ladataan varausjaksoja...")}</span>
				</div>
			) : isError ? (
				<Callout variant="danger">
					{t(
						"virheLadattaessaVarausjaksoja",
						"Virhe ladattaessa varausjaksoja.",
					)}
				</Callout>
			) : blocks && blocks.length > 0 ? (
				<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{blocks.map((block) => (
						<li key={block.id} className="min-w-0 *:h-full">
							<BlockCard item={block} resourceNames={resourceNames} />
						</li>
					))}
				</ul>
			) : (
				<PeriodEmptyState
					icon={CalendarCheck}
					start={start}
					months={months}
					what={t("sanaVarausjaksoja", "varausjaksoja")}
					onChange={updateSearch}
				/>
			)}
		</PageContainer>
	);
}
