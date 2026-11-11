import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	Check,
	ChevronRight,
	Clock,
	FileJson,
	Loader2,
	Printer,
	RotateCcw,
	X,
} from "lucide-react";
import { Dialog } from "radix-ui";
import { type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { CancelReservationDialog } from "#/components/CancelReservationDialog";
import { Chip } from "#/components/Chip";
import { EmptyState } from "#/components/EmptyState";
import { FilterBar } from "#/components/FilterBar";
import { OutlookBadge } from "#/components/OutlookBadge";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { PeriodNavigator } from "#/components/PeriodNavigator";
import { SegmentedControl } from "#/components/SegmentedControl";
import { Select } from "#/components/Select";
import { Textarea } from "#/components/Textarea";
import {
	type ReservationStatus,
	type ReservationWithOccurrences,
	useCancelReservation,
	useReservations,
	useUpdateReservation,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useRounds } from "#/hooks/useRounds";
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
	round_id?: string;
}

type PendingSort = "time" | "created";

const MAX_REASON_LENGTH = 500;

const firstStart = (r: ReservationWithOccurrences) =>
	r.occurrences?.[0]?.start_time
		? new Date(r.occurrences[0].start_time).getTime()
		: Number.MAX_SAFE_INTEGER;

/** Orders reservations by their first occurrence; ones without times go last */
const sortByDateAsc = (
	a: ReservationWithOccurrences,
	b: ReservationWithOccurrences,
) => firstStart(a) - firstStart(b);

/** Oldest request first: the ones that have waited longest */
const sortByCreatedAsc = (
	a: ReservationWithOccurrences,
	b: ReservationWithOccurrences,
) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();

export const Route = createFileRoute("/_app/admin/dashboard/")({
	validateSearch: (search: Record<string, unknown>): AdminDashboardSearch => {
		return {
			start_date:
				typeof search.start_date === "string" ? search.start_date : undefined,
			months: parsePeriodMonths(search.months),
			resource_id:
				typeof search.resource_id === "string" ? search.resource_id : undefined,
			round_id:
				typeof search.round_id === "string" ? search.round_id : undefined,
		};
	},
	component: AdminDashboardPage,
});

/** Pending requests can be approved/rejected one by one unless a round or Outlook decides them */
const isDecidableHere = (r: ReservationWithOccurrences) =>
	r.status === "pending" && !r.round_id && r.source !== "outlook";

function AdminReservationRow({
	reservationWithOcc,
	resourceMap,
	onStatusChange,
	onMarkPrinted,
	isUpdating,
	hoveredReservation,
	onHoverReservation,
	selectable,
	selected,
	onToggleSelected,
}: {
	reservationWithOcc: ReservationWithOccurrences;
	resourceMap: Map<string, string>;
	onStatusChange: (status: ReservationStatus) => void;
	onMarkPrinted: (id: string) => Promise<void>;
	isUpdating: boolean;
	hoveredReservation: ReservationWithOccurrences | null;
	onHoverReservation: (res: ReservationWithOccurrences | null) => void;
	/** Shows the checkbox column; the checkbox itself is only enabled for decidable rows */
	selectable: boolean;
	selected: boolean;
	onToggleSelected: () => void;
}) {
	const { t } = useTranslation();
	const { formatDateTime, formatRange } = useDateFormatter();
	const occurrences = reservationWithOcc.occurrences ?? [];
	const firstOccurrence = occurrences[0];
	const isPending = reservationWithOcc.status === "pending";
	const isOutlook = reservationWithOcc.source === "outlook";
	// Decided by the round's allocation, never approved one by one
	const isRoundApplication = isPending && Boolean(reservationWithOcc.round_id);
	const canSelect = isDecidableHere(reservationWithOcc);

	const isHoveredSource = hoveredReservation?.id === reservationWithOcc.id;

	// Gather resource names reserved by this item
	const resourceNames = useMemo(() => {
		const names = occurrences
			.map((occ) => resourceMap.get(occ.resource_id))
			.filter(Boolean);
		return Array.from(new Set(names)).join(", ");
	}, [occurrences, resourceMap]);

	// Precise Time & Resource Conflict Calculation
	const isConflict = useMemo(() => {
		if (!hoveredReservation || isHoveredSource) {
			return false;
		}

		const hoveredOccs = hoveredReservation.occurrences || [];

		return occurrences.some((curr) => {
			const currStart = new Date(curr.start_time).getTime();
			const currEnd = new Date(curr.end_time).getTime();

			return hoveredOccs.some((hov) => {
				if (hov.resource_id !== curr.resource_id) return false;
				const hovStart = new Date(hov.start_time).getTime();
				const hovEnd = new Date(hov.end_time).getTime();

				return currStart < hovEnd && currEnd > hovStart;
			});
		});
	}, [hoveredReservation, occurrences, isHoveredSource]);

	const handlePrintSingle = async () => {
		await onMarkPrinted(reservationWithOcc.id);
		const url = `/contracts/batch-print?reservation_ids=${reservationWithOcc.id}`;
		window.open(url, "_blank");
	};

	const createdText = formatDateTime(reservationWithOcc.created_at);
	const updatedText = formatDateTime(reservationWithOcc.updated_at);
	const timeSpan = firstOccurrence
		? formatRange(firstOccurrence.start_time, firstOccurrence.end_time)
		: null;

	return (
		<tr
			className={cn(
				"relative border-b border-stone-200 text-sm transition-colors last:border-b-0 hover:bg-stone-100 dark:border-stone-800 dark:hover:bg-stone-800/60",
				// Conflicting target rows: soft red background while hovering a time
				isConflict &&
					"bg-red-100 shadow-[inset_0_0_0_1px_var(--color-red-500)] dark:bg-red-950/60",
				isHoveredSource &&
					"bg-amber-100 shadow-[inset_0_0_0_1px_var(--color-amber-500)] dark:bg-amber-900/40",
			)}
		>
			{selectable && (
				<td className="w-10 px-3 py-2 align-top">
					{canSelect && (
						<input
							type="checkbox"
							checked={selected}
							onChange={onToggleSelected}
							aria-label={t("valitseVaraus", "Valitse varaus {{title}}", {
								title: reservationWithOcc.title,
							})}
							className="mt-1 size-4 cursor-pointer accent-stone-900 dark:accent-stone-100"
						/>
					)}
				</td>
			)}

			{/* Reservation title, requester and meta */}
			<td className="min-w-[220px] max-w-xl px-3 py-2 align-top">
				<div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
					<Link
						to="/reservations/$id"
						params={{ id: reservationWithOcc.id }}
						title={reservationWithOcc.title}
						className="focus-ring max-w-[18rem] truncate font-bold text-stone-900 hover:underline dark:text-stone-100"
					>
						{reservationWithOcc.title}
					</Link>

					{isOutlook && <OutlookBadge />}

					{reservationWithOcc.round_id && (
						<Link
							to="/admin/rounds/$id"
							params={{ id: reservationWithOcc.round_id }}
							title={t("varauskierros", "Varauskierros")}
							className="focus-ring"
						>
							<Chip>
								{reservationWithOcc.round_name}
								{reservationWithOcc.round_priority
									? ` · #${reservationWithOcc.round_priority}`
									: ""}
							</Chip>
						</Link>
					)}
				</div>
				{reservationWithOcc.user_name && (
					<p
						title={
							reservationWithOcc.user_email
								? `${reservationWithOcc.user_name} (${reservationWithOcc.user_email})`
								: reservationWithOcc.user_name
						}
						className="truncate text-xs text-stone-600 dark:text-stone-400"
					>
						{reservationWithOcc.user_name}
					</p>
				)}
				<p className="text-xs text-stone-600 tabular-nums dark:text-stone-400">
					{t("luotuPvm", "Luotu {{date}}", { date: createdText })}
					{updatedText !== createdText &&
						` · ${t("muokattuPvm", "Muokattu {{date}}", { date: updatedText })}`}
				</p>
			</td>

			{/* Resource */}
			<td className="min-w-[120px] px-3 py-2 align-top">
				{resourceNames ? (
					<span className="line-clamp-2">{resourceNames}</span>
				) : (
					<span className="text-stone-500">{"—"}</span>
				)}
			</td>

			{/* Time (hovering highlights overlapping reservations on the same resource) */}
			<td
				className="whitespace-nowrap px-3 py-2 align-top"
				onMouseEnter={() => onHoverReservation(reservationWithOcc)}
				onMouseLeave={() => onHoverReservation(null)}
			>
				{timeSpan ? (
					<div>
						<span
							className={cn(
								"inline-flex items-center gap-1 tabular-nums",
								isConflict && "font-bold text-red-800 dark:text-red-300",
							)}
						>
							{isConflict && (
								<AlertTriangle
									size={14}
									aria-hidden="true"
									className="shrink-0"
								/>
							)}
							{timeSpan}
						</span>
						{occurrences.length > 1 && (
							<p className="text-xs text-stone-600 dark:text-stone-400">
								{t("lisaaAikojaMaara", "+{{count}} muuta aikaa", {
									count: occurrences.length - 1,
								})}
							</p>
						)}
					</div>
				) : (
					<span className="text-xs text-stone-600 dark:text-stone-400">
						{t("eiTiettyjAikoja", "Ei tiettyjä aikoja")}
					</span>
				)}
			</td>

			{/* Actions */}
			<td className="whitespace-nowrap px-3 py-2 text-right align-top">
				<div className="flex items-center justify-end gap-2">
					<Button
						variant="ghost"
						size="iconSm"
						onClick={handlePrintSingle}
						aria-label={t("tulostaSopimukset", "Tulosta sopimukset")}
						title={t("tulostaSopimukset", "Tulosta sopimukset")}
					>
						<Printer size={16} />
					</Button>

					{isOutlook ? null : isRoundApplication ? (
						<Button variant="outline" size="sm" asChild>
							<Link
								to="/admin/rounds/$id"
								params={{ id: reservationWithOcc.round_id ?? "" }}
							>
								{t("kasitteleKierroksella", "Käsittele kierroksella")}
							</Link>
						</Button>
					) : isPending ? (
						<>
							<CancelReservationDialog
								reservationId={reservationWithOcc.id}
								reservationTitle={reservationWithOcc.title}
								trigger={
									<Button variant="outline" size="sm" disabled={isUpdating}>
										{t("hylk", "Hylkää")}
									</Button>
								}
							/>
							<Button
								size="sm"
								disabled={isUpdating}
								onClick={() => onStatusChange("confirmed" as ReservationStatus)}
							>
								{t("hyvksy", "Hyväksy")}
							</Button>
						</>
					) : (
						<Button
							variant="outline"
							size="sm"
							disabled={isUpdating}
							onClick={() => onStatusChange("pending" as ReservationStatus)}
						>
							<RotateCcw size={14} aria-hidden="true" />
							{t("palautaOdottavaksi", "Palauta odottavaksi")}
						</Button>
					)}
				</div>
			</td>
		</tr>
	);
}

interface ReservationTableProps {
	rows: ReservationWithOccurrences[];
	resourceMap: Map<string, string>;
	onStatusChange: (id: string, status: ReservationStatus) => void;
	onMarkPrinted: (id: string) => Promise<void>;
	isUpdating: boolean;
	hoveredReservation: ReservationWithOccurrences | null;
	onHoverReservation: (res: ReservationWithOccurrences | null) => void;
	/** Shows the checkbox column */
	selectable: boolean;
	selectedIds?: Set<string>;
	onToggleSelected?: (id: string) => void;
	/** Header checkbox for the select column */
	selectAll?: ReactNode;
}

/** Table with header row; the same layout for pending, confirmed and cancelled reservations */
function ReservationTable({
	rows,
	onStatusChange,
	selectedIds,
	onToggleSelected,
	selectAll,
	selectable,
	...rowProps
}: ReservationTableProps) {
	const { t } = useTranslation();
	return (
		<div className="overflow-x-auto">
			<table className="w-full min-w-[720px] border-collapse text-left">
				<thead>
					<tr className="border-y border-stone-300 bg-stone-100 font-mono text-xs uppercase tracking-wider text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-400">
						{selectable && (
							<th className="w-10 px-3 py-2 font-normal">{selectAll}</th>
						)}
						<th className="px-3 py-2 font-normal">
							{t("varausSarake", "Varaus")}
						</th>
						<th className="px-3 py-2 font-normal">
							{t("resurssi", "Resurssi")}
						</th>
						<th className="px-3 py-2 font-normal">{t("aika", "Aika")}</th>
						<th className="px-3 py-2 text-right font-normal">
							{t("toiminnot", "Toiminnot")}
						</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((res) => (
						<AdminReservationRow
							key={res.id}
							reservationWithOcc={res}
							onStatusChange={(s) => onStatusChange(res.id, s)}
							selectable={selectable}
							selected={selectedIds?.has(res.id) ?? false}
							onToggleSelected={() => onToggleSelected?.(res.id)}
							{...rowProps}
						/>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Collapsed-by-default section for the already decided reservations */
function HistorySection({
	title,
	count,
	emptyText,
	children,
}: {
	title: string;
	count: number;
	emptyText: string;
	children: ReactNode;
}) {
	return (
		<details className="group overflow-hidden rounded-md border border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
			<summary className="focus-ring flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-lg font-semibold text-stone-900 hover:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-800 [&::-webkit-details-marker]:hidden">
				<ChevronRight
					size={18}
					aria-hidden="true"
					className="shrink-0 transition-transform group-open:rotate-90"
				/>
				{title} {"("}
				{count}
				{")"}
			</summary>
			{count > 0 ? (
				children
			) : (
				<p className="px-4 pb-4 text-sm text-stone-600 dark:text-stone-400">
					{emptyText}
				</p>
			)}
		</details>
	);
}

/** Rejects (cancels) all given reservations one by one with a shared optional reason */
function BulkRejectDialog({
	count,
	onConfirm,
	busy,
	trigger,
}: {
	count: number;
	onConfirm: (reason: string) => Promise<void>;
	busy: boolean;
	trigger: ReactNode;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const reasonId = useId();

	const handleConfirm = async () => {
		await onConfirm(reason);
		setOpen(false);
		setReason("");
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
				<Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-md border border-stone-300 bg-stone-50 p-5 shadow-xl focus:outline-none dark:border-stone-700 dark:bg-stone-900">
					<div className="space-y-1">
						<Dialog.Title className="text-base font-bold text-stone-900 dark:text-stone-100">
							{t("hylkaaValitutOtsikko", "Hylkää valitut varaukset")}
						</Dialog.Title>
						<Dialog.Description className="text-sm text-stone-600 dark:text-stone-400">
							{t(
								"hylkaaValitutKuvaus",
								"Haluatko varmasti hylätä {{count}} varausta? Varaukset vapautuvat ja varaajille lähetetään ilmoitus.",
								{ count },
							)}
						</Dialog.Description>
					</div>

					<div className="space-y-1">
						<label
							htmlFor={reasonId}
							className="text-sm font-medium text-stone-800 dark:text-stone-200"
						>
							{t("peruutuksenSyyValinnainen", "Peruutuksen syy (valinnainen)")}
						</label>
						<Textarea
							id={reasonId}
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							maxLength={MAX_REASON_LENGTH}
							rows={3}
						/>
					</div>

					<div className="flex justify-end gap-2">
						<Dialog.Close asChild>
							<Button variant="outline" disabled={busy}>
								{t("cancel", "Peruuta")}
							</Button>
						</Dialog.Close>
						<Button variant="danger" onClick={handleConfirm} disabled={busy}>
							{busy && <Loader2 size={16} className="animate-spin" />}
							{t("hylkaaValitut", "Hylkää valitut")}
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

function AdminDashboardPage() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const [hoveredReservation, setHoveredReservation] =
		useState<ReservationWithOccurrences | null>(null);
	const [pendingSort, setPendingSort] = useState<PendingSort>("time");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [bulkBusy, setBulkBusy] = useState(false);
	const [bulkError, setBulkError] = useState<string | null>(null);

	const { data: resources, isLoading: loadingResources } = useResources();
	const updateReservation = useUpdateReservation();
	const cancelReservation = useCancelReservation();

	const resourceMap = useMemo(() => {
		return new Map(resources?.map((r) => [r.id, r.name]) || []);
	}, [resources]);

	// Admins review the whole current year by default
	const months = search.months ?? 12;
	const resourceId = search.resource_id;
	const roundId = search.round_id;
	const { data: rounds } = useRounds();

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
		roundId,
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
				// Round applications are handled on the round page; they only show here
				// when filtering by a round, and then without approve/reject actions
				pendingReservations: reservations
					.filter((r) => r.status === "pending")
					.filter((r) => !r.round_id || roundId !== undefined)
					.sort(pendingSort === "time" ? sortByDateAsc : sortByCreatedAsc),
				confirmedReservations: reservations
					.filter((r) => r.status === "confirmed")
					.sort(sortByDateAsc),
				cancelledReservations: reservations
					.filter((r) => r.status === "cancelled")
					.sort(sortByDateAsc),
			};
		}, [reservations, roundId, pendingSort]);

	// Only rows that can actually be decided here are selectable
	const selectableIds = useMemo(
		() => pendingReservations.filter(isDecidableHere).map((r) => r.id),
		[pendingReservations],
	);
	// Drop selections for rows that disappeared (decided, filtered away)
	const activeSelected = useMemo(
		() => selectableIds.filter((id) => selectedIds.has(id)),
		[selectableIds, selectedIds],
	);
	const allSelected =
		selectableIds.length > 0 && activeSelected.length === selectableIds.length;

	const toggleSelected = (id: string) =>
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});

	const toggleAll = () =>
		setSelectedIds(allSelected ? new Set() : new Set(selectableIds));

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

	/** Runs the single-reservation mutation for each selected id in sequence */
	const runBulk = async (action: (id: string) => Promise<unknown>) => {
		const ids = [...activeSelected];
		setBulkBusy(true);
		setBulkError(null);
		const failed: string[] = [];
		for (const id of ids) {
			try {
				await action(id);
			} catch {
				failed.push(id);
			}
		}
		setBulkBusy(false);
		// Keep the failed ones selected so the admin can retry
		setSelectedIds(new Set(failed));
		if (failed.length > 0) {
			setBulkError(
				t(
					"massatoimintoEpaonnistui",
					"{{failed}} / {{total}} varauksen käsittely epäonnistui.",
					{ failed: failed.length, total: ids.length },
				),
			);
		}
	};

	const handleBulkApprove = () =>
		runBulk((id) =>
			updateReservation.mutateAsync({
				id,
				payload: { status: "confirmed" as ReservationStatus },
			}),
		);

	const handleBulkReject = (reason: string) =>
		runBulk((id) => cancelReservation.mutateAsync({ id, reason }));

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

	const tableProps = {
		resourceMap,
		onStatusChange: handleStatusChange,
		onMarkPrinted: handleMarkPrinted,
		isUpdating: updateReservation.isPending || bulkBusy,
		hoveredReservation,
		onHoverReservation: setHoveredReservation,
	};

	return (
		<PageContainer>
			<PageHeader
				title={t("hyvaksynnat", "Hyväksynnät")}
				subtitle={t(
					"odottaaHyvaksyntaaMaara",
					"{{count}} varausta odottaa hyväksyntää",
					{ count: pendingReservations.length },
				)}
				actions={
					<>
						<Button variant="outline" asChild>
							<Link to="/admin/reservations">
								<FileJson size={16} aria-hidden="true" />
								{t("varaustenTuontiJaVienti", "Varausten tuonti ja vienti")}
							</Link>
						</Button>
						<Button
							variant="outline"
							disabled={confirmedReservations.length === 0}
							onClick={handleBatchPrintConfirmed}
							title={t(
								"tulostaKaikkiSopimukset",
								"Tulosta vahvistettujen varausten sopimukset ({{length}})",
								{ length: confirmedReservations.length },
							)}
						>
							<Printer size={16} aria-hidden="true" />
							{t("tulostaSopimuksetMaara", "Tulosta sopimukset ({{length}})", {
								length: confirmedReservations.length,
							})}
						</Button>
					</>
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
					wrapperClassName="w-auto"
					value={resourceId || ""}
					onChange={(e) =>
						updateSearch({ resource_id: e.target.value || undefined })
					}
					disabled={loadingResources}
					aria-label={t("resurssi", "Resurssi")}
				>
					<option value="">{t("kaikkiResurssit", "Kaikki resurssit")}</option>
					{resources?.map((res) => (
						<option key={res.id} value={res.id}>
							{res.name}
						</option>
					))}
				</Select>

				<Select
					size="sm"
					wrapperClassName="w-auto"
					value={roundId || ""}
					onChange={(e) =>
						updateSearch({ round_id: e.target.value || undefined })
					}
					aria-label={t("varauskierros", "Varauskierros")}
				>
					<option value="">{t("kaikkiKierrokset", "Kaikki kierrokset")}</option>
					{rounds?.map((round) => (
						<option key={round.id} value={round.id}>
							{round.name}
						</option>
					))}
				</Select>
			</FilterBar>

			{isLoading ? (
				<div className="flex items-center justify-center gap-2 p-8 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} />
					<span>
						{t("ladataanHallintapaneelia", "Ladataan hallintapaneelia...")}
					</span>
				</div>
			) : isError ? (
				<Callout variant="danger">
					{t(
						"virheLadattaessaVaraustietoja",
						"Virhe ladattaessa varaustietoja.",
					)}
				</Callout>
			) : (
				<>
					{/* L1: the pending approvals */}
					<section
						aria-labelledby="pending-heading"
						className="overflow-hidden rounded-md border-2 border-line-strong bg-surface-raised"
					>
						<div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
							<h2
								id="pending-heading"
								className="flex items-center gap-2 text-lg font-semibold text-stone-900 dark:text-stone-100"
							>
								<Clock
									size={18}
									aria-hidden="true"
									className="text-amber-700 dark:text-amber-400"
								/>
								{t(
									"odottaaHyvksyntLength",
									"Odottaa hyväksyntää ({{length}})",
									{ length: pendingReservations.length },
								)}
							</h2>
							{pendingReservations.length > 1 && (
								<div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
									<span>{t("jarjestys", "Järjestys")}</span>
									<SegmentedControl<PendingSort>
										aria-label={t("jarjestys", "Järjestys")}
										value={pendingSort}
										onChange={setPendingSort}
										options={[
											{ value: "time", label: t("jarjestysAika", "Ajankohta") },
											{
												value: "created",
												label: t("jarjestysLuotu", "Luontiaika"),
											},
										]}
									/>
								</div>
							)}
						</div>

						{activeSelected.length > 0 && (
							<div className="flex flex-wrap items-center gap-2 border-y border-stone-300 bg-stone-100 px-4 py-2 dark:border-stone-700 dark:bg-stone-800">
								<span className="mr-auto text-sm font-medium">
									{t("valittuMaara", "{{count}} valittu", {
										count: activeSelected.length,
									})}
								</span>
								<Button
									size="sm"
									disabled={bulkBusy}
									onClick={handleBulkApprove}
								>
									{bulkBusy ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Check size={14} aria-hidden="true" />
									)}
									{t("hyvaksyValitut", "Hyväksy valitut")}
								</Button>
								<BulkRejectDialog
									count={activeSelected.length}
									onConfirm={handleBulkReject}
									busy={bulkBusy}
									trigger={
										<Button variant="outline" size="sm" disabled={bulkBusy}>
											<X size={14} aria-hidden="true" />
											{t("hylkaaValitut", "Hylkää valitut")}
										</Button>
									}
								/>
								<Button
									variant="ghost"
									size="sm"
									disabled={bulkBusy}
									onClick={() => setSelectedIds(new Set())}
								>
									{t("tyhjennaValinta", "Tyhjennä valinta")}
								</Button>
							</div>
						)}

						{bulkError && (
							<div className="px-4 pb-3">
								<Callout variant="danger">{bulkError}</Callout>
							</div>
						)}

						{pendingReservations.length > 0 ? (
							<ReservationTable
								rows={pendingReservations}
								{...tableProps}
								selectable={selectableIds.length > 0}
								selectedIds={selectedIds}
								onToggleSelected={toggleSelected}
								selectAll={
									<input
										type="checkbox"
										checked={allSelected}
										onChange={toggleAll}
										aria-label={t("valitseKaikki", "Valitse kaikki")}
										className="size-4 cursor-pointer accent-stone-900 dark:accent-stone-100"
									/>
								}
							/>
						) : (
							<div className="px-4 pb-4">
								<EmptyState
									title={t("eiOdottaviaVarauksia", "Ei odottavia varauksia")}
								>
									{t(
										"eiOdottaviaVarauksiaValitullaAikavlill",
										"Ei odottavia varauksia valitulla aikavälillä.",
									)}
								</EmptyState>
							</div>
						)}
					</section>

					<div className="space-y-3">
						<HistorySection
							title={t("vahvistetutVarauksetOtsikko", "Vahvistetut varaukset")}
							count={confirmedReservations.length}
							emptyText={t(
								"eiVahvistettujaVarauksiaValitullaAikavlill",
								"Ei vahvistettuja varauksia valitulla aikavälillä.",
							)}
						>
							<ReservationTable
								rows={confirmedReservations}
								{...tableProps}
								selectable={false}
							/>
						</HistorySection>

						<HistorySection
							title={t(
								"hylatytJaPerututOtsikko",
								"Hylätyt ja perutut varaukset",
							)}
							count={cancelledReservations.length}
							emptyText={t(
								"eiHylttyjVarauksiaValitullaAikavlill",
								"Ei hylättyjä varauksia valitulla aikavälillä.",
							)}
						>
							<ReservationTable
								rows={cancelledReservations}
								{...tableProps}
								selectable={false}
							/>
						</HistorySection>
					</div>
				</>
			)}
		</PageContainer>
	);
}
