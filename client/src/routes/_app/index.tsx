// src/routes/_app/index.tsx

import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowUpRight,
	Box,
	Calendar,
	CheckCircle2,
	ChevronRight,
	Clock,
	Loader2,
	Plus,
	Shield,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { Footer } from "#/components/Footer";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { useReservations } from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { startOfCurrentWeek } from "#/utils/calendarUtils";
import { formatDate } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/")({
	component: HomePage,
});

function HomePage() {
	const { t } = useTranslation();
	const { user } = useAuth();
	const { isAdmin } = useIsAdmin();
	const { data: resources, isLoading: loadingResources } = useResources();

	// 1. Compute current week bounds for resource popularity counting
	const currentWeekStart = useMemo(() => startOfCurrentWeek(), []);
	const currentWeekEnd = useMemo(() => {
		const end = new Date(currentWeekStart);
		end.setDate(end.getDate() + 7);
		end.setHours(23, 59, 59, 999);
		return end;
	}, [currentWeekStart]);

	// Fetch reservations starting from current week start up to 30 days ahead
	const thirtyDaysLater = useMemo(() => {
		const d = new Date();
		d.setDate(d.getDate() + 30);
		return d;
	}, []);

	const { data: reservations, isLoading: loadingReservations } =
		useReservations({
			startDate: currentWeekStart.toISOString(),
			endDate: thirtyDaysLater.toISOString(),
		});

	// Filter personal or pending reservations
	const userReservations = useMemo(
		() => reservations?.filter((r) => r.user_id === user?.id) || [],
		[reservations, user?.id],
	);
	const pendingReservations = useMemo(
		() => reservations?.filter((r) => r.status === "pending") || [],
		[reservations],
	);

	// 2. Sort resources by active occurrence count within the current week
	const popularResources = useMemo(() => {
		if (!resources) return [];
		if (!reservations || reservations.length === 0)
			return resources.slice(0, 5);

		const counts = new Map<string, number>();

		reservations.forEach((res) => {
			res.occurrences?.forEach((occ) => {
				const occTime = new Date(occ.start_time).getTime();
				if (
					occTime >= currentWeekStart.getTime() &&
					occTime <= currentWeekEnd.getTime()
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
			.slice(0, 5);
	}, [resources, reservations, currentWeekStart, currentWeekEnd]);

	return (
		<div className="flex flex-col min-h-full -m-2 sm:-m-4">
			<div className="flex-1 flex flex-col gap-6 p-2 sm:p-4 max-w-6xl mx-auto w-full min-h-0 min-w-0 pb-12">
				{/* Hero Section */}
				<section className="p-6 md:p-8 rounded-lg bg-stone-100 dark:bg-stone-900 border-2 border-stone-800 dark:border-stone-700 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
					<div className="space-y-2 max-w-2xl">
						<h1 className="text-2xl sm:text-3xl md:text-4xl font-black tracking-tight text-stone-900 dark:text-stone-100">
							{t(
								"tervetuloaVaraamaanTilojaJaResursseja",
								"Tervetuloa varaamaan tiloja ja resursseja",
							)}
						</h1>
						<p className="text-sm text-stone-600 dark:text-stone-400">
							{t(
								"tarkasteleReaaliaikaistaKalenterivaraustilannettaTeeUusiaVarauksiaJaHallinnoiOmiaVarauksiasiHelposti",
								"Tarkastele reaaliaikaista kalenterivaraustilannetta, tee uusia\n\t\t\t\t\t\t\tvarauksia ja hallinnoi omia varauksiasi helposti.",
							)}
						</p>
					</div>

					<div className="flex flex-wrap sm:flex-col gap-2.5 w-full sm:w-auto shrink-0">
						<Button asChild size="lg" className="gap-2 justify-center">
							<Link to="/calendar">
								<Calendar size={18} />
								<span>{t("avaaKalenteri", "Avaa kalenteri")}</span>
							</Link>
						</Button>

						{user && (
							<Button
								asChild
								variant="outline"
								size="lg"
								className="gap-2 justify-center"
							>
								<Link to="/reservations/create">
									<Plus size={18} />
									<span>{t("uusiVaraus", "Uusi varaus")}</span>
								</Link>
							</Button>
						)}
					</div>
				</section>

				{/* Admin Notice Panel (visible only for Admins when pending items exist) */}
				{isAdmin && pendingReservations.length > 0 && (
					<section className="p-4 rounded-md bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-400 dark:border-amber-700 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
						<div className="flex items-center gap-3">
							<div className="p-2 bg-amber-200 dark:bg-amber-900/60 rounded-md text-amber-800 dark:text-amber-200 shrink-0">
								<Shield size={20} />
							</div>
							<div>
								<h2 className="font-bold text-sm text-amber-900 dark:text-amber-200">
									{t(
										"odottaviaHyvksyntjLength",
										"Odottavia hyväksyntöjä ({{length}})",
										{ length: pendingReservations.length },
									)}
								</h2>
								<p className="text-xs text-amber-700 dark:text-amber-400">
									{t(
										"jrjestelmssOnUusiaVarauspyyntjJotkaOdottavatYllpidonVahvistusta",
										"Järjestelmässä on uusia varauspyyntöjä, jotka odottavat\n\t\t\t\t\t\t\t\t\tylläpidon vahvistusta.",
									)}
								</p>
							</div>
						</div>

						<Button
							asChild
							size="sm"
							className="bg-amber-700 hover:bg-amber-800 text-white shrink-0 self-end sm:self-center"
						>
							<Link to="/admin/dashboard">
								<span>{t("ksittelePyynnt", "Käsittele pyynnöt")}</span>
								<ChevronRight size={16} />
							</Link>
						</Button>
					</section>
				)}

				{/* Grid Layout: Upcoming User Reservations & Resource Quick-Links */}
				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
					{/* Left Column (2 cols): User's Upcoming Reservations */}
					<div className="lg:col-span-2 space-y-3">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
								<Clock size={18} className="text-stone-500" />
								<span>{t("tulevatVarauksesi", "Tulevat varauksesi")}</span>
							</h2>

							{user && (
								<Button
									variant="ghost"
									size="sm"
									asChild
									className="text-xs gap-1"
								>
									<Link to="/reservations">
										<span>{t("kaikkiVaraukset", "Kaikki varaukset")}</span>
										<ChevronRight size={14} />
									</Link>
								</Button>
							)}
						</div>

						{!user ? (
							<div className="p-6 text-center border-2 border-dashed border-stone-300 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900/40 space-y-3">
								<p className="text-xs text-stone-500">
									{t(
										"kirjauduSisnNhdksesiOmatTulevatVarauksesiJaTehdksesiUusiaVarauksia",
										"Kirjaudu sisään nähdäksesi omat tulevat varauksesi ja\n\t\t\t\t\t\t\t\t\ttehdäksesi uusia varauksia.",
									)}
								</p>
							</div>
						) : loadingReservations ? (
							<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
								<Loader2 className="animate-spin" size={18} />
								<span>{t("ladataanVarauksia", "Ladataan varauksia...")}</span>
							</div>
						) : userReservations.length > 0 ? (
							<ul className="space-y-2.5">
								{userReservations.slice(0, 4).map((res) => {
									const firstOcc = res.occurrences?.[0];
									const isPending = res.status === "pending";
									const isConfirmed = res.status === "confirmed";

									return (
										<li
											key={res.id}
											className="p-3 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-purple-600 transition-colors"
										>
											<div className="space-y-1 min-w-0 flex-1">
												<div className="flex items-center gap-2 min-w-0">
													<Link
														to="/reservations/$id"
														params={{ id: res.id }}
														className="font-bold text-sm hover:underline text-stone-900 dark:text-stone-100 truncate"
													>
														{res.title}
													</Link>
													<Chip>{readable_uuid(res.id)}</Chip>
												</div>

												{firstOcc && (
													<p className="text-xs text-stone-500 font-mono">
														{formatDate(firstOcc.start_time)}
													</p>
												)}
											</div>

											<div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
												{isPending && (
													<span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-300 dark:border-amber-800">
														<Clock size={11} />
														<span>{t("odottaa", "Odottaa")}</span>
													</span>
												)}
												{isConfirmed && (
													<span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-800 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800">
														<CheckCircle2 size={11} />
														<span>{t("vahvistettu", "Vahvistettu")}</span>
													</span>
												)}

												<Button
													variant="secondary"
													size="sm"
													asChild
													className="text-xs gap-1"
												>
													<Link to="/reservations/$id" params={{ id: res.id }}>
														<span>{t("tiedot", "Tiedot")}</span>
														<ArrowUpRight size={14} />
													</Link>
												</Button>
											</div>
										</li>
									);
								})}
							</ul>
						) : (
							<div className="p-6 text-center border-2 border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900/40">
								<p className="text-xs text-stone-500">
									{t(
										"sinullaEiOleAktiivisiaVarauksiaLhitulevaisuudessa",
										"Sinulla ei ole aktiivisia varauksia lähitulevaisuudessa.",
									)}
								</p>
							</div>
						)}
					</div>

					{/* Right Column (1 col): Popular Resources Quick View */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
								<Box size={18} className="text-stone-500" />
								<span>{t("resurssit", "Resurssit")}</span>
							</h2>

							<Button
								variant="ghost"
								size="sm"
								asChild
								className="text-xs gap-1"
							>
								<Link to="/resources">
									<span>{t("selaaKaikkia", "Selaa kaikkia")}</span>
									<ChevronRight size={14} />
								</Link>
							</Button>
						</div>

						{loadingResources || loadingReservations ? (
							<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
								<Loader2 className="animate-spin" size={18} />
							</div>
						) : (
							<ul className="space-y-2">
								{popularResources.map((res) => (
									<li
										key={res.id}
										className="p-3 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900 flex items-center justify-between gap-2 hover:bg-stone-100 dark:hover:bg-stone-800/60 transition-colors"
									>
										<div className="min-w-0 flex-1">
											<h3 className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
												{res.name}
											</h3>
											<p className="text-[11px] text-stone-500 truncate">
												{res.description ||
													t("eiKuvaustaSaatavilla", "Ei kuvausta saatavilla")}
											</p>
										</div>

										<Button
											variant="ghost"
											size="icon"
											asChild
											className="shrink-0"
										>
											<Link to="/calendar" search={{ resources: [res.id] }}>
												<Calendar size={14} />
											</Link>
										</Button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			</div>

			{/* Rich Footer embedded naturally at page bottom */}
			<Footer />
		</div>
	);
}
