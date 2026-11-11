import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EntityCard } from "#/components/EntityCard";
import { FilterBar } from "#/components/FilterBar";
import { OutlookBadge } from "#/components/OutlookBadge";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { PeriodEmptyState } from "#/components/PeriodEmptyState";
import { PeriodNavigator } from "#/components/PeriodNavigator";
import { ReservationStatusChip } from "#/components/ReservationStatusChip";
import { ResourceFilterField } from "#/components/ResourceFilterField";
import {
	type ReservationWithOccurrences,
	useMyReservations,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useOpenRounds } from "#/hooks/useRounds";
import { requireAuthGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import {
	getPeriodRange,
	type PeriodMonths,
	parsePeriodMonths,
} from "#/utils/period";
import { parseResourceList, touchesResources } from "#/utils/resourceSearch";

export interface UserDashboardSearch {
	start_date?: string;
	months?: PeriodMonths;
	/** Selected resource ids; missing means all */
	resources?: string[];
}

export const Route = createFileRoute("/_app/reservations/")({
	validateSearch: (search: Record<string, unknown>): UserDashboardSearch => {
		return {
			start_date:
				typeof search.start_date === "string" ? search.start_date : undefined,
			months: parsePeriodMonths(search.months),
			resources: parseResourceList(search.resources, search.resource_id),
		};
	},
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: UserDashboardPage,
});

function ReservationCard({
	reservation,
	resourceNames,
}: {
	reservation: ReservationWithOccurrences;
	resourceNames: Map<string, string>;
}) {
	const { t } = useTranslation();
	const { formatRange } = useDateFormatter();
	const occurrences = reservation.occurrences ?? [];
	const first = occurrences[0];
	const resources = [
		...new Set(
			occurrences.map((occ) => resourceNames.get(occ.resource_id) ?? ""),
		),
	].filter(Boolean);

	const when = first
		? occurrences.length > 1
			? t("ensimmainenAikaJaMuut", "{{first}} + {{count}} muuta", {
					first: formatRange(first.start_time, first.end_time),
					count: occurrences.length - 1,
				})
			: formatRange(first.start_time, first.end_time)
		: t("eiTiettyjAikoja", "Ei tiettyjä aikoja");

	return (
		<EntityCard
			to="/reservations/$id"
			params={{ id: reservation.id }}
			title={reservation.title}
			meta={
				<>
					<span className="tabular-nums">{when}</span>
					{resources.length > 0 && (
						<>
							{" "}
							{"·"} {resources.join(", ")}
						</>
					)}
				</>
			}
			badges={
				<>
					<ReservationStatusChip status={reservation.status} />
					{reservation.source === "outlook" && <OutlookBadge />}
				</>
			}
		/>
	);
}

function ReservationSection({
	title,
	reservations,
	resourceNames,
}: {
	title: string;
	reservations: ReservationWithOccurrences[];
	resourceNames: Map<string, string>;
}) {
	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
				{title}
				<span className="ml-2 text-sm font-normal text-stone-600 tabular-nums dark:text-stone-400">
					{reservations.length}
				</span>
			</h2>
			<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{reservations.map((reservation) => (
					<li
						key={reservation.id}
						className="flex min-w-0 flex-col [&>a]:flex-1"
					>
						<ReservationCard
							reservation={reservation}
							resourceNames={resourceNames}
						/>
					</li>
				))}
			</ul>
		</section>
	);
}

function UserDashboardPage() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { formatDateTime } = useDateFormatter();

	const { data: resources } = useResources();
	const { data: openRounds } = useOpenRounds();

	const months = search.months ?? 1;
	const selectedResources = search.resources;

	const { start, startDateISO, endDateISO } = useMemo(
		() => getPeriodRange(search.start_date, months),
		[search.start_date, months],
	);

	const {
		data: reservations,
		isLoading,
		isError,
	} = useMyReservations({
		startDate: startDateISO,
		endDate: endDateISO,
	});

	const resourceNames = useMemo(
		() => new Map(resources?.map((res) => [res.id, res.name])),
		[resources],
	);

	const byStatus = (status: ReservationWithOccurrences["status"]) =>
		(reservations ?? []).filter(
			(r) =>
				r.status === status &&
				touchesResources(r.occurrences, selectedResources),
		);
	const pending = byStatus("pending");
	const confirmed = byStatus("confirmed");
	const cancelled = byStatus("cancelled");

	const updateSearch = (next: UserDashboardSearch) => {
		navigate({
			search: (prev) => ({ ...prev, ...next }),
			replace: true,
		});
	};

	return (
		<PageContainer>
			<PageHeader
				title={t("omatVaraukset", "Omat varaukset")}
				actions={
					<Button asChild>
						<Link to="/reservations/create">
							<Plus size={16} aria-hidden="true" />
							{t("uusiVaraus", "Uusi varaus")}
						</Link>
					</Button>
				}
			/>

			{openRounds && openRounds.length > 0 && (
				<div className="space-y-2">
					{openRounds.map((round) => (
						<Callout
							key={round.id}
							variant="info"
							action={
								<Button variant="outline" size="sm" asChild>
									<Link to="/reservations/rounds/$id" params={{ id: round.id }}>
										{t("avaaKierros", "Avaa kierros")}
									</Link>
								</Button>
							}
						>
							<strong>{round.name}</strong>
							{" – "}
							{t("hakuaikaPttyy", "Haku päättyy")}{" "}
							<span className="tabular-nums">
								{formatDateTime(round.applications_close_at)}
							</span>
						</Callout>
					))}
				</div>
			)}

			<FilterBar>
				<PeriodNavigator
					start={start}
					months={months}
					onChange={updateSearch}
				/>
			</FilterBar>

			<ResourceFilterField
				value={selectedResources}
				onChange={(resources) => updateSearch({ resources })}
			/>

			{isLoading ? (
				<div className="flex items-center justify-center gap-2 p-8 text-sm text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} aria-hidden="true" />
					<span>{t("ladataanVarauksiasi", "Ladataan varauksiasi...")}</span>
				</div>
			) : isError ? (
				<Callout variant="danger">
					{t(
						"virheLadattaessaVaraustietoja",
						"Virhe ladattaessa varaustietoja.",
					)}
				</Callout>
			) : pending.length + confirmed.length + cancelled.length === 0 ? (
				<PeriodEmptyState
					start={start}
					months={months}
					what={t("sanaVarauksia", "varauksia")}
					onChange={updateSearch}
					action={
						<Button asChild size="sm">
							<Link to="/reservations/create">
								{t("uusiVaraus", "Uusi varaus")}
							</Link>
						</Button>
					}
				/>
			) : (
				<>
					{pending.length > 0 && (
						<ReservationSection
							title={t("odottaaHyvaksyntaa", "Odottaa hyväksyntää")}
							reservations={pending}
							resourceNames={resourceNames}
						/>
					)}
					{confirmed.length > 0 && (
						<ReservationSection
							title={t("vahvistetutVarauksetOsio", "Vahvistetut varaukset")}
							reservations={confirmed}
							resourceNames={resourceNames}
						/>
					)}
					{cancelled.length > 0 && (
						<details className="group space-y-3">
							<summary className="focus-ring w-fit cursor-pointer select-none text-lg font-semibold text-stone-900 hover:underline dark:text-stone-100">
								{t("perututVaraukset", "Perutut varaukset")}
								<span className="ml-2 text-sm font-normal text-stone-600 tabular-nums dark:text-stone-400">
									{cancelled.length}
								</span>
							</summary>
							<ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
								{cancelled.map((reservation) => (
									<li
										key={reservation.id}
										className="flex min-w-0 flex-col [&>a]:flex-1"
									>
										<ReservationCard
											reservation={reservation}
											resourceNames={resourceNames}
										/>
									</li>
								))}
							</ul>
						</details>
					)}
				</>
			)}
		</PageContainer>
	);
}
