import { useQueries } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Calendar,
	Check,
	CheckCircle2,
	ChevronLeft,
	ChevronRight,
	Clock,
	FileText,
	Loader2,
	Printer,
	X,
	XCircle,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { api } from "#/api/client";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import {
	type Contract,
	contractKeys,
	getLocalizedText,
	useContracts,
} from "#/hooks/useContracts";
import {
	type ReservationStatus,
	type ReservationWithOccurrences,
	useReservations,
	useUpdateReservation,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { startOfCurrentWeek } from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";
import { formatDate } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export interface AdminDashboardSearch {
	start_date?: string;
	days?: number;
	resource_id?: string;
}

const formatYYYYMMDD = (d: Date) => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string): Date => {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const Route = createFileRoute("/_app/admin/dashboard/")({
	validateSearch: (search: Record<string, unknown>): AdminDashboardSearch => {
		return {
			start_date:
				typeof search.start_date === "string" ? search.start_date : undefined,
			days: typeof search.days === "number" ? search.days : undefined,
			resource_id:
				typeof search.resource_id === "string" ? search.resource_id : undefined,
		};
	},
	component: AdminDashboardPage,
});

/** Hook to resolve all applicable contracts for a set of resource IDs */
function useReservationContracts(resourceIds: string[]) {
	// Query GET /contracts?resource_id=X for every unique resource ID
	const contractQueries = useQueries({
		queries: resourceIds.map((rId) => ({
			queryKey: contractKeys.list({ resource_id: rId, active_only: true }),
			queryFn: async () => {
				const { data, error } = await api.GET("/contracts", {
					params: { query: { resource_id: rId, active_only: true } },
				});
				if (error || !data) return [];
				return data as Contract[];
			},
			enabled: Boolean(rId),
			staleTime: 1000 * 60 * 5,
		})),
	});

	return useMemo(() => {
		const contractMap = new Map<string, Contract>();
		for (const q of contractQueries) {
			if (q.data) {
				for (const contract of q.data) {
					contractMap.set(contract.id, contract);
				}
			}
		}
		return Array.from(contractMap.values());
	}, [contractQueries]);
}

function AdminReservationCard({
	reservationWithOcc,
	onStatusChange,
	onMarkPrinted,
	isUpdating,
}: {
	reservationWithOcc: ReservationWithOccurrences;
	onStatusChange: (status: ReservationStatus) => void;
	onMarkPrinted: (id: string) => Promise<void>;
	isUpdating: boolean;
}) {
	const { t, i18n } = useTranslation();
	const firstOccurrence = reservationWithOcc.occurrences?.[0];
	const isPending = reservationWithOcc.status === "pending";
	const isCancelled = reservationWithOcc.status === "cancelled";

	// Collect unique resource IDs involved in this reservation
	const resourceIds = useMemo(() => {
		return Array.from(
			new Set(
				(reservationWithOcc.occurrences || []).map((occ) => occ.resource_id),
			),
		);
	}, [reservationWithOcc.occurrences]);

	// Dynamically fetch contracts applicable to these resources
	const applicableContracts = useReservationContracts(resourceIds);

	const handlePrintSingle = async () => {
		await onMarkPrinted(reservationWithOcc.id);
		const url = `/contracts/batch-print?reservation_ids=${reservationWithOcc.id}`;
		window.open(url, "_blank");
	};

	return (
		<li
			className={cn(
				"p-3 border-2 flex flex-col justify-between gap-3 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors min-w-0",
				isPending
					? "border-amber-400 dark:border-amber-600"
					: isCancelled
						? "border-rose-300 dark:border-rose-900/60 opacity-80"
						: "border-stone-200 dark:border-stone-700",
			)}
		>
			<div className="flex items-start justify-between gap-2 min-w-0">
				<Link
					to="/reservations/$id"
					params={{ id: reservationWithOcc.id }}
					className="font-bold truncate hover:underline text-stone-900 dark:text-stone-100 flex-1 text-sm md:text-base"
				>
					{reservationWithOcc.title}
				</Link>
				<Chip>{readable_uuid(reservationWithOcc.id)}</Chip>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2 min-w-0">
				{firstOccurrence ? (
					<div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
						<Calendar size={14} />
						<span>{formatDate(firstOccurrence.start_time)}</span>
					</div>
				) : (
					<span className="text-xs text-stone-400">
						{t("eiTiettyjAikoja", "Ei tiettyjä aikoja")}
					</span>
				)}

				{reservationWithOcc.contract_printed_at && (
					<span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 shrink-0">
						<Check size={11} />
						<span>{t("tulostettu", "Tulostettu")}</span>
					</span>
				)}
			</div>

			{/* Applicable Contracts Chips */}
			{applicableContracts.length > 0 && (
				<div className="flex flex-wrap gap-1 pt-1 border-t border-stone-200 dark:border-stone-800">
					{applicableContracts.map((c) => (
						<span
							key={c.id}
							className={cn(
								"px-1.5 py-0.5 text-[10px] font-medium rounded truncate max-w-[140px]",
								c.is_global
									? "bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300"
									: "bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/50 dark:border-amber-800/50",
							)}
							title={getLocalizedText(c.title, i18n.language)}
						>
							{getLocalizedText(c.title, i18n.language)}
						</span>
					))}
				</div>
			)}

			{/* Action Buttons Row */}
			<div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
				<Button
					variant="outline"
					size="sm"
					onClick={handlePrintSingle}
					className="text-stone-700 dark:text-stone-300 text-xs px-2 py-1 gap-1 flex-1 sm:flex-initial justify-center"
				>
					<FileText size={14} className="text-amber-600 dark:text-amber-500" />
					<span>{t("tulostaSopimukset", "Tulosta sopimukset")}</span>
				</Button>

				<div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
					{isPending ? (
						<>
							<Button
								variant="outline"
								size="sm"
								disabled={isUpdating}
								onClick={() => onStatusChange("cancelled" as ReservationStatus)}
								className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs px-2.5 py-1 flex-1 sm:flex-initial justify-center"
							>
								<X size={14} />
								<span>{t("hylk", "Hylkää")}</span>
							</Button>
							<Button
								size="sm"
								disabled={isUpdating}
								onClick={() => onStatusChange("confirmed" as ReservationStatus)}
								className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1 flex-1 sm:flex-initial justify-center"
							>
								<Check size={14} />
								<span>{t("hyvksy", "Hyväksy")}</span>
							</Button>
						</>
					) : (
						<Button
							variant="outline"
							size="sm"
							disabled={isUpdating}
							onClick={() => onStatusChange("pending" as ReservationStatus)}
							className="text-stone-600 dark:text-stone-400 text-xs px-2.5 py-1 w-full sm:w-auto justify-center"
						>
							<Clock size={14} />
							<span>{t("palautaOdottavaksi", "Palauta odottavaksi")}</span>
						</Button>
					)}
				</div>
			</div>
		</li>
	);
}

function AdminDashboardPage() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const { data: resources, isLoading: loadingResources } = useResources();
	const updateReservation = useUpdateReservation();

	const defaultStartStr = formatYYYYMMDD(startOfCurrentWeek());
	const startStr = search.start_date || defaultStartStr;
	const days = search.days || 14;
	const resourceId = search.resource_id;

	const start = useMemo(() => parseLocalDate(startStr), [startStr]);

	const { startDateISO, endDateISO } = useMemo(() => {
		const startDate = new Date(start);
		startDate.setHours(0, 0, 0, 0);

		const endDate = new Date(start);
		endDate.setDate(endDate.getDate() + days);
		endDate.setHours(23, 59, 59, 999);

		return {
			startDateISO: startDate.toISOString(),
			endDateISO: endDate.toISOString(),
		};
	}, [start, days]);

	const {
		data: reservations,
		isLoading,
		isError,
	} = useReservations({
		startDate: startDateISO,
		endDate: endDateISO,
		resourceId,
	});

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
				pendingReservations: reservations.filter((r) => r.status === "pending"),
				confirmedReservations: reservations.filter(
					(r) => r.status === "confirmed",
				),
				cancelledReservations: reservations.filter(
					(r) => r.status === "cancelled",
				),
			};
		}, [reservations]);

	const updateSearch = (next: AdminDashboardSearch) => {
		navigate({
			search: (prev) => ({ ...prev, ...next }),
			replace: true,
		});
	};

	const moveStart = (deltaDays: number) => {
		const next = new Date(start);
		next.setDate(next.getDate() + deltaDays);
		updateSearch({ start_date: formatYYYYMMDD(next) });
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
			{/* Header with Batch Print Action */}
			<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<h1 className="text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
					{t("yllpidonHallintapaneeli", "Ylläpidon hallintapaneeli")}
				</h1>

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
							"Tulosta vahvistettujen sopimukset ({{length}})",
							{ length: confirmedReservations.length },
						)}
					</span>
				</Button>
			</div>

			{/* Controls Bar */}
			<div className="flex flex-wrap items-center gap-2 shrink-0 p-2 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
				<div className="flex items-center gap-1">
					<Button
						variant="secondary"
						size="sm"
						onClick={() => moveStart(-days)}
					>
						<ChevronLeft size={16} />
					</Button>

					<input
						type="date"
						value={formatYYYYMMDD(start)}
						onChange={(e) =>
							e.target.valueAsDate &&
							updateSearch({ start_date: formatYYYYMMDD(e.target.valueAsDate) })
						}
						className="px-2.5 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-mono"
					/>

					<Button variant="secondary" size="sm" onClick={() => moveStart(days)}>
						<ChevronRight size={16} />
					</Button>
				</div>

				<select
					value={days}
					onChange={(e) => updateSearch({ days: Number(e.target.value) })}
					className="px-2.5 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-medium"
				>
					<option value={7}>{t("1Viikko", "1 viikko")}</option>
					<option value={14}>{t("2Viikkoa", "2 viikkoa")}</option>
					<option value={30}>{t("1Kuukausi", "1 kuukausi")}</option>
					<option value={90}>{t("3Kuukautta", "3 kuukautta")}</option>
				</select>

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
					{/* Pending Approvals */}
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
							<ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
								{pendingReservations.map((res) => (
									<AdminReservationCard
										key={res.id}
										reservationWithOcc={res}
										onStatusChange={(s) => handleStatusChange(res.id, s)}
										onMarkPrinted={handleMarkPrinted}
										isUpdating={updateReservation.isPending}
									/>
								))}
							</ul>
						) : (
							<div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
								{t(
									"eiOdottaviaVarauksiaValitullaAikavlill",
									"Ei odottavia varauksia valitulla aikavälillä.",
								)}
							</div>
						)}
					</div>

					{/* Confirmed Reservations */}
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
							<ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
								{confirmedReservations.map((res) => (
									<AdminReservationCard
										key={res.id}
										reservationWithOcc={res}
										onStatusChange={(s) => handleStatusChange(res.id, s)}
										onMarkPrinted={handleMarkPrinted}
										isUpdating={updateReservation.isPending}
									/>
								))}
							</ul>
						) : (
							<div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
								{t(
									"eiVahvistettujaVarauksiaValitullaAikavlill",
									"Ei vahvistettuja varauksia valitulla aikavälillä.",
								)}
							</div>
						)}
					</div>

					{/* Cancelled / Rejected Reservations */}
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
							<ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
								{cancelledReservations.map((res) => (
									<AdminReservationCard
										key={res.id}
										reservationWithOcc={res}
										onStatusChange={(s) => handleStatusChange(res.id, s)}
										onMarkPrinted={handleMarkPrinted}
										isUpdating={updateReservation.isPending}
									/>
								))}
							</ul>
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
