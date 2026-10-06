import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	Calendar,
	Check,
	CheckCircle2,
	Clock,
	FileJson,
	FileText,
	Loader2,
	Printer,
	User as UserIcon,
	X,
	XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { OutlookBadge } from "#/components/OutlookBadge";
import { PeriodNavigator } from "#/components/PeriodNavigator";
import {
	type ReservationStatus,
	type ReservationWithOccurrences,
	useReservations,
	useUpdateReservation,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { cn } from "#/utils/cn";
import { useDateFormatter } from "#/utils/date";
import {
	getPeriodRange,
	type PeriodMonths,
	parsePeriodMonths,
} from "#/utils/period";

export interface AdminDashboardSearch {
	start_date?: string;
	months?: PeriodMonths;
	resource_id?: string;
}

/** Orders reservations by their first occurrence; ones without times go last */
const sortByDateAsc = (
	a: ReservationWithOccurrences,
	b: ReservationWithOccurrences,
) => {
	const timeA = a.occurrences?.[0]?.start_time
		? new Date(a.occurrences[0].start_time).getTime()
		: Number.MAX_SAFE_INTEGER;
	const timeB = b.occurrences?.[0]?.start_time
		? new Date(b.occurrences[0].start_time).getTime()
		: Number.MAX_SAFE_INTEGER;
	return timeA - timeB;
};

export const Route = createFileRoute("/_app/admin/dashboard/")({
	validateSearch: (search: Record<string, unknown>): AdminDashboardSearch => {
		return {
			start_date:
				typeof search.start_date === "string" ? search.start_date : undefined,
			months: parsePeriodMonths(search.months),
			resource_id:
				typeof search.resource_id === "string" ? search.resource_id : undefined,
		};
	},
	component: AdminDashboardPage,
});

function AdminReservationRow({
	reservationWithOcc,
	resourceMap,
	onStatusChange,
	onMarkPrinted,
	isUpdating,
	hoveredReservation,
	onHoverReservation,
}: {
	reservationWithOcc: ReservationWithOccurrences;
	resourceMap: Map<string, string>;
	onStatusChange: (status: ReservationStatus) => void;
	onMarkPrinted: (id: string) => Promise<void>;
	isUpdating: boolean;
	hoveredReservation: ReservationWithOccurrences | null;
	onHoverReservation: (res: ReservationWithOccurrences | null) => void;
}) {
	const { t } = useTranslation();
	const { formatDate, formatDateRange } = useDateFormatter();
	const firstOccurrence = reservationWithOcc.occurrences?.[0];
	const isPending = reservationWithOcc.status === "pending";
	const isCancelled = reservationWithOcc.status === "cancelled";
	const isOutlook = reservationWithOcc.source === "outlook";

	const isHoveredSource = hoveredReservation?.id === reservationWithOcc.id;

	// Gather resource names reserved by this item
	const resourceNames = useMemo(() => {
		if (!reservationWithOcc.occurrences) return "";
		const names = reservationWithOcc.occurrences
			.map((occ) => resourceMap.get(occ.resource_id))
			.filter(Boolean);
		return Array.from(new Set(names)).join(", ");
	}, [reservationWithOcc.occurrences, resourceMap]);

	// Precise Time & Resource Conflict Calculation
	const isConflict = useMemo(() => {
		if (!hoveredReservation || isHoveredSource) {
			return false;
		}

		const hoveredOccs = hoveredReservation.occurrences || [];
		const currentOccs = reservationWithOcc.occurrences || [];

		return currentOccs.some((curr) => {
			const currStart = new Date(curr.start_time).getTime();
			const currEnd = new Date(curr.end_time).getTime();

			return hoveredOccs.some((hov) => {
				if (hov.resource_id !== curr.resource_id) return false;
				const hovStart = new Date(hov.start_time).getTime();
				const hovEnd = new Date(hov.end_time).getTime();

				return currStart < hovEnd && currEnd > hovStart;
			});
		});
	}, [hoveredReservation, reservationWithOcc, isHoveredSource]);

	const handlePrintSingle = async () => {
		await onMarkPrinted(reservationWithOcc.id);
		const url = `/contracts/batch-print?reservation_ids=${reservationWithOcc.id}`;
		window.open(url, "_blank");
	};

	const formattedTimeSpan = firstOccurrence
		? formatDateRange(firstOccurrence.start_time, firstOccurrence.end_time)
		: null;

	return (
		<tr
			className={cn(
				"border-b border-stone-200 dark:border-stone-800 hover:bg-stone-100/80 dark:hover:bg-stone-800/80 transition-colors text-xs font-mono relative outline-none select-none",
				isPending && "bg-amber-50/40 dark:bg-amber-950/20",
				isCancelled && "opacity-60 bg-stone-50/30 dark:bg-stone-950/30",
				// Conflicting target rows: soft rose background and subtle inset shadow instead of outline
				isConflict &&
					"bg-rose-100/80 dark:bg-rose-950/60 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.6)] z-10",
				// Active source row: soft amber background and subtle inset shadow
				isHoveredSource &&
					"bg-amber-100/80 dark:bg-amber-900/40 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.8)] z-20",
			)}
		>
			{/* Reservation Title & User */}
			<td className="py-2 px-3 align-middle min-w-[200px] max-w-xl">
				<div className="flex items-center gap-2 min-w-0">
					<Link
						to="/reservations/$id"
						params={{ id: reservationWithOcc.id }}
						title={reservationWithOcc.title}
						className="font-bold hover:underline text-stone-900 dark:text-stone-100 text-xs truncate max-w-[16rem]"
					>
						{reservationWithOcc.title}
					</Link>

					{isOutlook && <OutlookBadge />}

					{reservationWithOcc.user_name && (
						<span
							title={
								reservationWithOcc.user_email
									? `${reservationWithOcc.user_name} (${reservationWithOcc.user_email})`
									: reservationWithOcc.user_name
							}
							className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-0.5 font-sans min-w-0 max-w-[20rem]"
						>
							<UserIcon
								size={11}
								className="shrink-0 text-stone-400 dark:text-stone-500"
							/>
							<span className="truncate">{reservationWithOcc.user_name}</span>
							{reservationWithOcc.user_email && (
								<span className="text-stone-400 font-mono text-[10px] truncate hidden xl:inline">
									{"("}
									{reservationWithOcc.user_email}
									{")"}
								</span>
							)}
						</span>
					)}
				</div>
				<div className="mt-0.5 flex flex-wrap gap-x-3 text-[10px] text-stone-400 dark:text-stone-500 font-sans">
					<span>
						{t("luotu", "Luotu:")} {formatDate(reservationWithOcc.created_at)}
					</span>
					<span>
						{t("muokattu", "Muokattu:")}{" "}
						{formatDate(reservationWithOcc.updated_at)}
					</span>
				</div>
			</td>

			{/* Resource Column */}
			<td className="py-2 px-3 align-middle whitespace-nowrap min-w-[120px]">
				{resourceNames ? (
					<span className="inline-block text-[11px] font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 border border-purple-200/60 dark:border-purple-800/60 px-1.5 py-0.5 rounded truncate max-w-[180px]">
						{resourceNames}
					</span>
				) : (
					<span className="text-stone-400 italic text-[11px]">{"—"}</span>
				)}
			</td>

			{/* Date & Full Time Span Column */}
			<td
				className="py-2 px-3 align-middle whitespace-nowrap cursor-pointer select-none"
				onMouseEnter={() => onHoverReservation(reservationWithOcc)}
				onMouseLeave={() => onHoverReservation(null)}
			>
				{formattedTimeSpan ? (
					<div
						className={cn(
							"inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors",
							isConflict
								? "bg-rose-200 dark:bg-rose-900 text-rose-950 dark:text-rose-100 font-bold"
								: isHoveredSource
									? "bg-amber-200 dark:bg-amber-800 text-amber-950 dark:text-amber-100 font-bold"
									: "text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800/80 hover:bg-stone-200 dark:hover:bg-stone-700",
						)}
					>
						{isConflict ? (
							<AlertTriangle
								size={12}
								className="shrink-0 text-rose-600 dark:text-rose-400"
							/>
						) : (
							<Calendar size={12} className="shrink-0 text-stone-400" />
						)}
						<span>{formattedTimeSpan}</span>
					</div>
				) : (
					<span className="text-stone-400 italic text-[11px]">
						{t("eiTiettyjAikoja", "Ei tiettyjä aikoja")}
					</span>
				)}
			</td>

			{/* Action Buttons (Secondary Style) */}
			<td className="py-2 px-3 align-middle text-right whitespace-nowrap">
				<div className="flex items-center justify-end gap-1">
					<Button
						variant="secondary"
						size="sm"
						onClick={handlePrintSingle}
						title={t("tulostaSopimukset", "Tulosta sopimukset")}
						className="text-[11px] px-2 py-0.5 h-7 gap-1 font-mono"
					>
						<FileText
							size={12}
							className="text-amber-600 dark:text-amber-500"
						/>
						<span className="hidden xl:inline">{t("tulosta", "Tulosta")}</span>
					</Button>

					{isOutlook ? null : isPending ? (
						<>
							<Button
								variant="secondary"
								size="sm"
								disabled={isUpdating}
								onClick={() => onStatusChange("cancelled" as ReservationStatus)}
								className="text-rose-600 hover:text-rose-700 dark:text-rose-400 text-[11px] px-2 py-0.5 h-7 gap-1 font-mono"
							>
								<X size={12} />
								<span>{t("hylk", "Hylkää")}</span>
							</Button>
							<Button
								variant="secondary"
								size="sm"
								disabled={isUpdating}
								onClick={() => onStatusChange("confirmed" as ReservationStatus)}
								className="text-emerald-700 dark:text-emerald-400 font-bold text-[11px] px-2 py-0.5 h-7 gap-1 font-mono"
							>
								<Check size={12} />
								<span>{t("hyvksy", "Hyväksy")}</span>
							</Button>
						</>
					) : (
						<Button
							variant="secondary"
							size="sm"
							disabled={isUpdating}
							onClick={() => onStatusChange("pending" as ReservationStatus)}
							className="text-[11px] px-2 py-0.5 h-7 gap-1 font-mono"
						>
							<Clock size={12} />
							<span>{t("palautaOdottavaksi", "Palauta odottavaksi")}</span>
						</Button>
					)}
				</div>
			</td>
		</tr>
	);
}

function AdminDashboardPage() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const [hoveredReservation, setHoveredReservation] =
		useState<ReservationWithOccurrences | null>(null);

	const { data: resources, isLoading: loadingResources } = useResources();
	const updateReservation = useUpdateReservation();

	const resourceMap = useMemo(() => {
		return new Map(resources?.map((r) => [r.id, r.name]) || []);
	}, [resources]);

	// Admins review the whole current year by default
	const months = search.months ?? 12;
	const resourceId = search.resource_id;

	const { start, startDateISO, endDateISO } = useMemo(
		() => getPeriodRange(search.start_date, months),
		[search.start_date, months],
	);

	const {
		data: reservations,
		isLoading,
		isError,
	} = useReservations({
		startDate: startDateISO,
		endDate: endDateISO,
		resourceId,
	});

	// Chronological sorter helper (earliest start_time first)
	const { pendingReservations, confirmedReservations, cancelledReservations } =
		useMemo(() => {
			if (!reservations) {
				return {
					pendingReservations: [],
					confirmedReservations: [],
					cancelledReservations: [],
				};
			}

			return {
				pendingReservations: reservations
					.filter((r) => r.status === "pending")
					.sort(sortByDateAsc),
				confirmedReservations: reservations
					.filter((r) => r.status === "confirmed")
					.sort(sortByDateAsc),
				cancelledReservations: reservations
					.filter((r) => r.status === "cancelled")
					.sort(sortByDateAsc),
			};
		}, [reservations]);

	const updateSearch = (next: AdminDashboardSearch) => {
		navigate({
			search: (prev) => ({ ...prev, ...next }),
			replace: true,
		});
	};

	const handleStatusChange = async (id: string, status: ReservationStatus) => {
		await updateReservation.mutateAsync({
			id,
			payload: { status },
		});
	};

	const handleMarkPrinted = async (id: string) => {
		await updateReservation.mutateAsync({
			id,
			payload: { mark_printed: true },
		});
	};

	const handleBatchPrintConfirmed = async () => {
		if (confirmedReservations.length === 0) return;

		await Promise.all(
			confirmedReservations.map((r) =>
				updateReservation.mutateAsync({
					id: r.id,
					payload: { mark_printed: true },
				}),
			),
		);

		const ids = confirmedReservations.map((r) => r.id).join(",");
		const url = `/contracts/batch-print?reservation_ids=${ids}`;
		window.open(url, "_blank");
	};

	return (
		<div className="flex flex-col gap-4 sm:gap-6 p-2 sm:p-4 flex-1 min-h-0 min-w-0">
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<h1 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
					{t("yllpidonHallintapaneeli", "Ylläpidon hallintapaneeli")}
				</h1>

				<div className="flex flex-col sm:flex-row gap-2">
					<Button
						variant="secondary"
						asChild
						size="sm"
						className="gap-1.5 justify-center w-full sm:w-auto text-xs shrink-0"
					>
						<Link to="/admin/reservations">
							<FileJson size={16} />
							<span>
								{t("varaustenTuontiJaVienti", "Varausten tuonti ja vienti")}
							</span>
						</Link>
					</Button>
					<Button
						size="sm"
						disabled={confirmedReservations.length === 0}
						onClick={handleBatchPrintConfirmed}
						className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5 justify-center w-full sm:w-auto text-xs shrink-0"
					>
						<Printer size={16} />
						<span className="truncate">
							{t(
								"tulostaKaikkiSopimukset",
								"Tulosta vahvistettujen varausten sopimukset ({{length}})",
								{ length: confirmedReservations.length },
							)}
						</span>
					</Button>
				</div>
			</div>

			<div className="flex flex-wrap items-center gap-2 shrink-0 p-2 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
				<PeriodNavigator
					start={start}
					months={months}
					onChange={updateSearch}
				/>

				<select
					value={resourceId || ""}
					onChange={(e) =>
						updateSearch({ resource_id: e.target.value || undefined })
					}
					disabled={loadingResources}
					className="px-2.5 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-medium max-w-full truncate"
				>
					<option value="">{t("kaikkiResurssit", "Kaikki resurssit")}</option>
					{resources?.map((res) => (
						<option key={res.id} value={res.id}>
							{res.name}
						</option>
					))}
				</select>
			</div>

			{isLoading ? (
				<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
					<Loader2 className="animate-spin" size={18} />
					<span>
						{t("ladataanHallintapaneelia", "Ladataan hallintapaneelia...")}
					</span>
				</div>
			) : isError ? (
				<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
					{t(
						"virheLadattaessaVaraustietoja",
						"Virhe ladattaessa varaustietoja.",
					)}
				</div>
			) : (
				<div className="space-y-6">
					{/* Pending Reservations Inbox Section */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold">
							<Clock size={18} />
							<h2 className="text-sm sm:text-base">
								{t(
									"odottaaHyvksyntLength",
									"Odottaa hyväksyntää ({{length}})",
									{ length: pendingReservations.length },
								)}
							</h2>
						</div>

						{pendingReservations.length > 0 ? (
							<div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-x-auto bg-stone-50 dark:bg-stone-900">
								<table className="w-full text-left border-collapse min-w-[650px]">
									<thead>
										<tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-100/80 dark:bg-stone-800/80 text-[11px] text-stone-500 font-mono uppercase tracking-wider">
											<th className="py-2 px-3">{t("varaus", "Varaus")}</th>
											<th className="py-2 px-3">{t("resurssi", "Resurssi")}</th>
											<th className="py-2 px-3">{t("aika", "Aika")}</th>
											<th className="py-2 px-3 text-right">
												{t("toiminnot", "Toiminnot")}
											</th>
										</tr>
									</thead>
									<tbody>
										{pendingReservations.map((res) => (
											<AdminReservationRow
												key={res.id}
												reservationWithOcc={res}
												resourceMap={resourceMap}
												onStatusChange={(s) => handleStatusChange(res.id, s)}
												onMarkPrinted={handleMarkPrinted}
												isUpdating={updateReservation.isPending}
												hoveredReservation={hoveredReservation}
												onHoverReservation={setHoveredReservation}
											/>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
								{t(
									"eiOdottaviaVarauksiaValitullaAikavlill",
									"Ei odottavia varauksia valitulla aikavälillä.",
								)}
							</div>
						)}
					</div>

					{/* Confirmed Reservations Inbox Section */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-bold">
							<CheckCircle2 size={18} />
							<h2 className="text-sm sm:text-base">
								{t(
									"vahvistetutVarauksetLength",
									"Vahvistetut varaukset ({{length}})",
									{ length: confirmedReservations.length },
								)}
							</h2>
						</div>

						{confirmedReservations.length > 0 ? (
							<div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-x-auto bg-stone-50 dark:bg-stone-900">
								<table className="w-full text-left border-collapse min-w-[650px]">
									<thead>
										<tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-100/80 dark:bg-stone-800/80 text-[11px] text-stone-500 font-mono uppercase tracking-wider">
											<th className="py-2 px-3">{t("varaus", "Varaus")}</th>
											<th className="py-2 px-3">{t("resurssi", "Resurssi")}</th>
											<th className="py-2 px-3">{t("aika", "Aika")}</th>
											<th className="py-2 px-3 text-right">
												{t("toiminnot", "Toiminnot")}
											</th>
										</tr>
									</thead>
									<tbody>
										{confirmedReservations.map((res) => (
											<AdminReservationRow
												key={res.id}
												reservationWithOcc={res}
												resourceMap={resourceMap}
												onStatusChange={(s) => handleStatusChange(res.id, s)}
												onMarkPrinted={handleMarkPrinted}
												isUpdating={updateReservation.isPending}
												hoveredReservation={hoveredReservation}
												onHoverReservation={setHoveredReservation}
											/>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
								{t(
									"eiVahvistettujaVarauksiaValitullaAikavlill",
									"Ei vahvistettuja varauksia valitulla aikavälillä.",
								)}
							</div>
						)}
					</div>

					{/* Cancelled Reservations Inbox Section */}
					<div className="space-y-3">
						<div className="flex items-center gap-2 text-rose-600 dark:text-rose-500 font-bold">
							<XCircle size={18} />
							<h2 className="text-sm sm:text-base">
								{t(
									"hyltytJaPerututVarauksetLength",
									"Hylätyt ja perutut varaukset ({{length}})",
									{ length: cancelledReservations.length },
								)}
							</h2>
						</div>

						{cancelledReservations.length > 0 ? (
							<div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-x-auto bg-stone-50 dark:bg-stone-900">
								<table className="w-full text-left border-collapse min-w-[650px]">
									<thead>
										<tr className="border-b border-stone-200 dark:border-stone-800 bg-stone-100/80 dark:bg-stone-800/80 text-[11px] text-stone-500 font-mono uppercase tracking-wider">
											<th className="py-2 px-3">{t("varaus", "Varaus")}</th>
											<th className="py-2 px-3">{t("resurssi", "Resurssi")}</th>
											<th className="py-2 px-3">{t("aika", "Aika")}</th>
											<th className="py-2 px-3 text-right">
												{t("toiminnot", "Toiminnot")}
											</th>
										</tr>
									</thead>
									<tbody>
										{cancelledReservations.map((res) => (
											<AdminReservationRow
												key={res.id}
												reservationWithOcc={res}
												resourceMap={resourceMap}
												onStatusChange={(s) => handleStatusChange(res.id, s)}
												onMarkPrinted={handleMarkPrinted}
												isUpdating={updateReservation.isPending}
												hoveredReservation={hoveredReservation}
												onHoverReservation={setHoveredReservation}
											/>
										))}
									</tbody>
								</table>
							</div>
						) : (
							<div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
								{t(
									"eiHylttyjVarauksiaValitullaAikavlill",
									"Ei hylättyjä varauksia valitulla aikavälillä.",
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
