import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Calendar,
	CalendarX,
	CheckCircle2,
	ChevronRight,
	Clock,
	Loader2,
	LogIn,
	Plus,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EmptyState } from "#/components/EmptyState";
import { Footer } from "#/components/Footer";
import { OutlookBadge } from "#/components/OutlookBadge";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { StatusChip } from "#/components/StatusChip";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { useMyReservations, useReservations } from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { currentYearRange } from "#/utils/calendarUtils";
import { addDays, startOfWeek, useDateFormatter } from "#/utils/date";
import { stripOutlookPrefix } from "#/utils/reservationTitle";
import { getLocalizedPlainText } from "#/utils/richText";
import { upcomingReservations } from "#/utils/upcomingReservations";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

const UPCOMING_LIMIT = 5;
const RESOURCE_LIMIT = 5;

function HomePage() {
	const { t, i18n } = useTranslation();
	const { formatRange } = useDateFormatter();
	const { user } = useAuth();
	const { isAdmin } = useIsAdmin();
	const { data: resources, isLoading: loadingResources } = useResources();

	// Monday 00:00 up to (not including) next Monday 00:00
	const currentWeekStart = useMemo(() => startOfWeek(), []);
	const nextWeekStart = useMemo(
		() => addDays(currentWeekStart, 7),
		[currentWeekStart],
	);

	// Same query as the approvals dashboard's default (whole current year)
	const yearRange = useMemo(() => currentYearRange(), []);

	const { data: reservations, isLoading: loadingReservations } =
		useReservations({
			startDate: yearRange.start.toISOString(),
			endDate: yearRange.end.toISOString(),
		});

	// Starts at today's midnight to keep the query key stable through the day;
	// upcomingReservations does the exact cutoff. The API allows a span of 365 days at most.
	const upcomingRange = useMemo(() => {
		const today = addDays(new Date(), 0);
		return { start: today, end: addDays(today, 364) };
	}, []);

	const { data: myReservations, isLoading: loadingMyReservations } =
		useMyReservations(
			{
				startDate: upcomingRange.start.toISOString(),
				endDate: upcomingRange.end.toISOString(),
			},
			{ enabled: Boolean(user) },
		);

	const userUpcoming = useMemo(
		() => upcomingReservations(myReservations ?? [], new Date()),
		[myReservations],
	);

	// Round applications are handled on their round page, not on the dashboard, so they
	// are left out here too to keep the count equal to the dashboard's pending list
	const pendingCount = useMemo(
		() =>
			reservations?.filter((r) => r.status === "pending" && !r.round_id)
				.length ?? 0,
		[reservations],
	);

	const resourceNames = useMemo(
		() => new Map(resources?.map((r) => [r.id, r.name]) ?? []),
		[resources],
	);

	const popularResources = useMemo(() => {
		if (!resources) return [];
		if (!reservations || reservations.length === 0)
			return resources.slice(0, RESOURCE_LIMIT);

		const counts = new Map<string, number>();

		reservations.forEach((res) => {
			res.occurrences?.forEach((occ) => {
				const occTime = new Date(occ.start_time).getTime();
				if (
					occTime >= currentWeekStart.getTime() &&
					occTime < nextWeekStart.getTime()
				) {
					const current = counts.get(occ.resource_id) || 0;
					counts.set(occ.resource_id, current + 1);
				}
			});
		});

		return [...resources]
			.map((res) => ({
				resource: res,
				weeklyCount: counts.get(res.id) || 0,
			}))
			.sort((a, b) => b.weeklyCount - a.weeklyCount)
			.map((item) => item.resource)
			.slice(0, RESOURCE_LIMIT);
	}, [resources, reservations, currentWeekStart, nextWeekStart]);

	const upcomingSection = (
		<section className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-lg font-semibold">
					{t("tulevatVarauksesi", "Tulevat varauksesi")}
				</h2>
				{user && (
					<Button variant="ghost" size="sm" asChild>
						<Link to="/reservations">
							<span>{t("kaikkiVaraukset", "Kaikki varaukset")}</span>
							<ChevronRight size={14} />
						</Link>
					</Button>
				)}
			</div>

			{!user ? (
				<EmptyState
					icon={LogIn}
					title={t(
						"kirjauduSisnNhdksesiOmatTulevatVarauksesiJaTehdksesiUusiaVarauksia",
						"Kirjaudu sisään nähdäksesi omat tulevat varauksesi ja tehdäksesi uusia varauksia.",
					)}
				/>
			) : loadingMyReservations ? (
				<div className="flex items-center justify-center gap-2 p-8 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} />
					<span className="text-sm">
						{t("ladataanVarauksia", "Ladataan varauksia...")}
					</span>
				</div>
			) : userUpcoming.length > 0 ? (
				<ul className="space-y-2">
					{userUpcoming
						.slice(0, UPCOMING_LIMIT)
						.map(({ reservation: res, nextOccurrence }) => {
							const isOutlook = res.source === "outlook";
							const resourceName = resourceNames.get(
								nextOccurrence.resource_id,
							);
							return (
								<li key={res.id}>
									<Link
										to="/reservations/$id"
										params={{ id: res.id }}
										className="focus-ring flex flex-col gap-2 rounded-md hover-card border border-line-subtle bg-surface-raised p-3 sm:flex-row sm:items-center sm:justify-between"
									>
										<div className="min-w-0 space-y-0.5">
											<div className="flex min-w-0 items-center gap-2">
												<span className="truncate text-sm font-bold text-stone-900 dark:text-stone-100">
													{isOutlook
														? stripOutlookPrefix(res.title)
														: res.title}
												</span>
												{isOutlook && <OutlookBadge />}
											</div>
											<p className="text-xs tabular-nums text-stone-600 dark:text-stone-400">
												{resourceName && <span>{resourceName} · </span>}
												{formatRange(
													nextOccurrence.start_time,
													nextOccurrence.end_time,
												)}
											</p>
										</div>
										{res.status === "pending" && (
											<StatusChip variant="warning" icon={Clock}>
												{t("odottaa", "Odottaa")}
											</StatusChip>
										)}
										{res.status === "confirmed" && (
											<StatusChip variant="success" icon={CheckCircle2}>
												{t("vahvistettu", "Vahvistettu")}
											</StatusChip>
										)}
									</Link>
								</li>
							);
						})}
				</ul>
			) : (
				<EmptyState
					icon={CalendarX}
					title={t(
						"sinullaEiOleAktiivisiaVarauksiaLhitulevaisuudessa",
						"Sinulla ei ole aktiivisia varauksia lähitulevaisuudessa.",
					)}
				/>
			)}
		</section>
	);

	const resourcesSection = (
		<section className="space-y-3">
			<div className="flex items-center justify-between gap-2">
				<h2 className="text-lg font-semibold">{t("resurssit", "Resurssit")}</h2>
				<Button variant="ghost" size="sm" asChild>
					<Link to="/resources">
						<span>{t("selaaKaikkia", "Selaa kaikkia")}</span>
						<ChevronRight size={14} />
					</Link>
				</Button>
			</div>

			{loadingResources || loadingReservations ? (
				<div className="flex items-center justify-center p-8 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} />
				</div>
			) : (
				<ul className="space-y-2">
					{popularResources.map((res) => {
						const description = getLocalizedPlainText(
							res.description,
							i18n.language,
						);
						return (
							<li key={res.id}>
								<Link
									to="/resources/$id"
									params={{ id: res.id }}
									className="focus-ring block rounded-md hover-card border border-line-subtle bg-surface-raised p-3"
								>
									<span className="block truncate text-sm font-bold text-stone-900 dark:text-stone-100">
										{res.name}
									</span>
									{description && (
										<span className="block truncate text-xs text-stone-600 dark:text-stone-400">
											{description}
										</span>
									)}
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);

	// The footer bleeds out of the shell's padding to the edges of the content area
	return (
		<div className="-mx-4 -my-6 flex min-h-[calc(100%+3rem)] flex-col md:-mx-8">
			<div className="flex-1 px-4 py-6 md:px-8">
				{user ? (
					<PageContainer>
						<PageHeader
							title={t("etusivu", "Etusivu")}
							actions={
								<Button asChild>
									<Link to="/reservations/create">
										<Plus size={18} />
										<span>{t("uusiVaraus", "Uusi varaus")}</span>
									</Link>
								</Button>
							}
						/>

						{isAdmin && pendingCount > 0 && (
							<Callout
								variant="warning"
								title={t(
									"odottaviaHyvksyntjLength",
									"Odottavia hyväksyntöjä ({{length}})",
									{ length: pendingCount },
								)}
								action={
									<Button asChild variant="outline" size="sm">
										<Link to="/admin/dashboard">
											<span>{t("ksittelePyynnt", "Käsittele pyynnöt")}</span>
											<ChevronRight size={16} />
										</Link>
									</Button>
								}
							>
								{t(
									"jrjestelmssOnUusiaVarauspyyntjJotkaOdottavatYllpidonVahvistusta",
									"Järjestelmässä on uusia varauspyyntöjä, jotka odottavat ylläpidon vahvistusta.",
								)}
							</Callout>
						)}

						<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
							<div className="lg:col-span-2">{upcomingSection}</div>
							{resourcesSection}
						</div>
					</PageContainer>
				) : (
					<PageContainer>
						<section className="space-y-4 rounded-md border border-stone-300 bg-stone-100 p-6 md:p-8 dark:border-stone-700 dark:bg-stone-900">
							<h1 className="max-w-3xl text-4xl font-extrabold tracking-tight text-stone-900 dark:text-stone-100">
								{t(
									"tervetuloaVaraamaanTilojaJaResursseja",
									"Tervetuloa varaamaan tiloja ja resursseja",
								)}
							</h1>
							<p className="max-w-2xl text-sm text-stone-600 dark:text-stone-400">
								{t(
									"tarkasteleReaaliaikaistaKalenterivaraustilannettaTeeUusiaVarauksiaJaHallinnoiOmiaVarauksiasiHelposti",
									"Tarkastele reaaliaikaista kalenterivaraustilannetta, tee uusia varauksia ja hallinnoi omia varauksiasi helposti.",
								)}
							</p>
							<Button asChild size="lg">
								<Link to="/calendar">
									<Calendar size={18} />
									<span>{t("avaaKalenteri", "Avaa kalenteri")}</span>
								</Link>
							</Button>
						</section>

						<div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
							<div className="lg:col-span-2">{upcomingSection}</div>
							{resourcesSection}
						</div>
					</PageContainer>
				)}
			</div>

			<Footer />
		</div>
	);
}
