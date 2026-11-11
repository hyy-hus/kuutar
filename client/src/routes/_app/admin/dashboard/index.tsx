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
import { Fragment, type ReactNode, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { CancelReservationDialog } from "#/components/CancelReservationDialog";
import { Chip, ToggleChip } from "#/components/Chip";
import { ConflictChip, type ConflictItem } from "#/components/ConflictChip";
import { EmptyState } from "#/components/EmptyState";
import { FilterBar } from "#/components/FilterBar";
import { OutlookBadge } from "#/components/OutlookBadge";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { PeriodNavigator } from "#/components/PeriodNavigator";
import { Select } from "#/components/Select";
import { StatusChip } from "#/components/StatusChip";
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
import { formatYYYYMMDD, useDateFormatter } from "#/utils/date";
import {
	getPeriodRange,
	type PeriodMonths,
	parsePeriodMonths,
} from "#/utils/period";
import {
	findConflicts,
	overlappingOccurrence,
	reservationsOverlap,
} from "#/utils/reservationConflicts";

export interface AdminDashboardSearch {
	start_date?: string;
	months?: PeriodMonths;
	resource_id?: string;
	round_id?: string;
}

type PendingSort = "time" | "created";

const MAX_REASON_LENGTH = 500;
/** Pending rows shown before "Show more" */
const PAGE_SIZE = 25;

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
	conflictItems,
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
	/** What this pending reservation clashes with (empty for none) */
	conflictItems: ConflictItem[];
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

	// Highlighted while another row's time or conflict chip is hovered/focused
	const isConflict =
		hoveredReservation !== null &&
		!isHoveredSource &&
		reservationsOverlap(hoveredReservation, reservationWithOcc);

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
				"relative flex flex-col gap-1 border-b border-stone-200 p-3 text-sm transition-colors last:border-b-0 hover:bg-stone-100 md:table-row md:p-0 dark:border-stone-800 dark:hover:bg-stone-800/60",
				// Conflicting target rows: soft red background while hovering a time
				isConflict &&
					"bg-red-100 shadow-[inset_0_0_0_1px_var(--color-red-500)] dark:bg-red-950/60",
				isHoveredSource &&
					"bg-amber-100 shadow-[inset_0_0_0_1px_var(--color-amber-500)] dark:bg-amber-900/40",
			)}
		>
			{selectable && (
				<td className="absolute right-3 top-3 md:static md:table-cell md:w-10 md:px-3 md:py-2 md:align-top">
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
			<td className="block min-w-0 pr-8 md:table-cell md:min-w-[220px] md:max-w-xl md:px-3 md:py-2 md:pr-3 md:align-top">
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
			<td className="block md:table-cell md:min-w-[120px] md:px-3 md:py-2 md:align-top">
				{resourceNames ? (
					<span className="line-clamp-2">{resourceNames}</span>
				) : (
					<span className="text-stone-500">{"—"}</span>
				)}
			</td>

			{/* Time; hovering it highlights overlapping reservations on the same resource */}
			<td
				className="block md:table-cell md:px-3 md:py-2 md:align-top"
				onMouseEnter={() => onHoverReservation(reservationWithOcc)}
				onMouseLeave={() => onHoverReservation(null)}
			>
				{timeSpan ? (
					<div className="space-y-1">
						<span
							className={cn(
								"inline-flex items-center gap-1 tabular-nums md:whitespace-nowrap",
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
						{conflictItems.length > 0 && (
							<div>
								<ConflictChip
									conflicts={conflictItems}
									onActiveChange={(active) =>
										onHoverReservation(active ? reservationWithOcc : null)
									}
								/>
							</div>
						)}
					</div>
				) : (
					<span className="text-xs text-stone-600 dark:text-stone-400">
						{t("eiTiettyjAikoja", "Ei tiettyjä aikoja")}
					</span>
				)}
			</td>

			{/* Actions */}
			<td className="block md:table-cell md:whitespace-nowrap md:px-3 md:py-2 md:text-right md:align-top">
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
									<Button variant="ghost" size="sm" disabled={isUpdating}>
										<X size={14} aria-hidden="true" />
										{t("hylk", "Hylkää")}
									</Button>
								}
							/>
							<Button
								variant="outline"
								size="sm"
								disabled={isUpdating}
								onClick={() => onStatusChange("confirmed" as ReservationStatus)}
							>
								<Check size={14} aria-hidden="true" />
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
	/** Conflict details per reservation id (pending rows only) */
	conflicts?: Map<string, ConflictItem[]>;
	/** Inserts a sticky day header before the first row of each day (rows must be time-sorted) */
	groupByDay?: boolean;
}

/** Local-day key and label of a reservation's first occurrence */
const dayKey = (r: ReservationWithOccurrences) => {
	const start = r.occurrences?.[0]?.start_time;
	return start ? formatYYYYMMDD(new Date(start)) : "none";
};

/**
 * Table with header row; the same layout for pending, confirmed and cancelled reservations.
 * Below `md` the rows stack as cards. No inner scroll container: the page scrolls, so the
 * header (and day headers) can stick to the top of the scroll area.
 */
function ReservationTable({
	rows,
	onStatusChange,
	selectedIds,
	onToggleSelected,
	selectAll,
	selectable,
	conflicts,
	groupByDay,
	...rowProps
}: ReservationTableProps) {
	const { t } = useTranslation();
	const { formatWeekday, formatDayMonth } = useDateFormatter();
	const columns = selectable ? 5 : 4;
	return (
		<table className="block w-full border-collapse text-left md:table">
			<thead className="hidden md:table-header-group">
				<tr className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400 [&>th]:sticky [&>th]:top-0 [&>th]:z-20 [&>th]:border-y [&>th]:border-stone-300 [&>th]:bg-stone-100 dark:[&>th]:border-stone-700 dark:[&>th]:bg-stone-800">
					{selectable && (
						<th className="h-8 w-10 px-3 py-2 font-normal">{selectAll}</th>
					)}
					<th className="h-8 px-3 py-2 font-normal">
						{t("varausSarake", "Varaus")}
					</th>
					<th className="h-8 px-3 py-2 font-normal">
						{t("resurssi", "Resurssi")}
					</th>
					<th className="h-8 px-3 py-2 font-normal">{t("aika", "Aika")}</th>
					<th className="h-8 px-3 py-2 text-right font-normal">
						{t("toiminnot", "Toiminnot")}
					</th>
				</tr>
			</thead>
			<tbody className="block md:table-row-group">
				{rows.map((res, i) => {
					const key = dayKey(res);
					const showDay =
						groupByDay && (i === 0 || dayKey(rows[i - 1]) !== key);
					const start = res.occurrences?.[0]?.start_time;
					return (
						<Fragment key={res.id}>
							{showDay && (
								<tr className="block md:table-row">
									<th
										colSpan={columns}
										scope="colgroup"
										className="sticky top-0 z-10 block border-b border-stone-300 bg-stone-200 px-3 py-1 text-left text-xs font-semibold text-stone-800 first-letter:uppercase md:top-8 md:table-cell dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
									>
										{start
											? `${formatWeekday(start)} ${formatDayMonth(start)}`
											: t("eiTiettyjAikoja", "Ei tiettyjä aikoja")}
									</th>
								</tr>
							)}
							<AdminReservationRow
								reservationWithOcc={res}
								onStatusChange={(s) => onStatusChange(res.id, s)}
								selectable={selectable}
								selected={selectedIds?.has(res.id) ?? false}
								onToggleSelected={() => onToggleSelected?.(res.id)}
								conflictItems={conflicts?.get(res.id) ?? []}
								{...rowProps}
							/>
						</Fragment>
					);
				})}
			</tbody>
		</table>
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
	const { formatDayMonth, formatTime, formatRange } = useDateFormatter();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const [hoveredReservation, setHoveredReservation] =
		useState<ReservationWithOccurrences | null>(null);
	const [pendingSort, setPendingSort] = useState<PendingSort>("time");
	const [onlyConflicts, setOnlyConflicts] = useState(false);
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
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

	// Which pending reservations clash with another live one, and with what
	const conflictsById = useMemo(
		() => findConflicts(pendingReservations, reservations ?? []),
		[pendingReservations, reservations],
	);
	const conflictItems = useMemo(() => {
		const byId = new Map<string, ConflictItem[]>();
		for (const r of pendingReservations) {
			const others = conflictsById.get(r.id);
			if (!others) continue;
			byId.set(
				r.id,
				others.map((o) => {
					const occ = overlappingOccurrence(r, o);
					return {
						id: o.id,
						title: o.title,
						resource: occ ? (resourceMap.get(occ.resource_id) ?? "") : "",
						time: occ ? formatRange(occ.start_time, occ.end_time) : "",
					};
				}),
			);
		}
		return byId;
	}, [pendingReservations, conflictsById, resourceMap, formatRange]);

	const filteredPending = useMemo(
		() =>
			onlyConflicts
				? pendingReservations.filter((r) => conflictsById.has(r.id))
				: pendingReservations,
		[onlyConflicts, pendingReservations, conflictsById],
	);
	const visiblePending = filteredPending.slice(0, visibleCount);

	// Summary strip: soonest upcoming request (falls back to the earliest overall)
	const nextStart = useMemo(() => {
		const starts = pendingReservations
			.map(firstStart)
			.filter((n) => n !== Number.MAX_SAFE_INTEGER);
		const upcoming = starts.filter((n) => n >= Date.now());
		const pool = upcoming.length > 0 ? upcoming : starts;
		return pool.length > 0 ? new Date(Math.min(...pool)) : null;
	}, [pendingReservations]);

	// Only visible rows that can actually be decided here are selectable
	const selectableIds = useMemo(
		() => visiblePending.filter(isDecidableHere).map((r) => r.id),
		[visiblePending],
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
				subtitle={t("hyvaksynnatKuvaus", "Päällekkäiset pyynnöt on merkitty.")}
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
					{pendingReservations.length > 0 && (
						<p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-700 tabular-nums dark:text-stone-300">
							<span className="font-semibold">
								{t("odottaaMaara", "{{count}} odottaa", {
									count: pendingReservations.length,
								})}
							</span>
							<span aria-hidden="true">{"·"}</span>
							{conflictsById.size > 0 ? (
								<StatusChip variant="danger" icon={AlertTriangle}>
									{t("ristiriitaaMaara", "{{count}} ristiriitaa", {
										count: conflictsById.size,
									})}
								</StatusChip>
							) : (
								<span>{t("eiRistiriitojaYhteenveto", "ei ristiriitoja")}</span>
							)}
							{nextStart && (
								<>
									<span aria-hidden="true">{"·"}</span>
									<span>
										{t("seuraavaAika", "seuraava: {{time}}", {
											time: `${formatDayMonth(nextStart)} ${formatTime(nextStart)}`,
										})}
									</span>
								</>
							)}
						</p>
					)}

					{/* L1: the pending approvals. No overflow clipping, so the sticky header works. */}
					<section
						aria-labelledby="pending-heading"
						className="rounded-md border-2 border-line-strong bg-surface-raised"
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
								<div className="flex flex-wrap items-center gap-3">
									<ToggleChip
										selected={onlyConflicts}
										onClick={() => setOnlyConflicts((v) => !v)}
										disabled={conflictsById.size === 0 && !onlyConflicts}
									>
										<AlertTriangle size={12} aria-hidden="true" />
										{t("vainRistiriidat", "Vain ristiriidat")}
									</ToggleChip>
									<div className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400">
										<span aria-hidden="true">{t("jarjesta", "Järjestä")}</span>
										<Select
											size="sm"
											wrapperClassName="w-auto"
											aria-label={t("jarjesta", "Järjestä")}
											value={pendingSort}
											onChange={(e) =>
												setPendingSort(e.target.value as PendingSort)
											}
										>
											<option value="time">
												{t("jarjestaAika", "Ajankohdan mukaan")}
											</option>
											<option value="created">
												{t("jarjestaLuotu", "Luontiajan mukaan")}
											</option>
										</Select>
									</div>
								</div>
							)}
						</div>

						{bulkError && (
							<div className="px-4 pb-3">
								<Callout variant="danger">{bulkError}</Callout>
							</div>
						)}

						{visiblePending.length > 0 ? (
							<>
								<ReservationTable
									rows={visiblePending}
									{...tableProps}
									conflicts={conflictItems}
									groupByDay={pendingSort === "time"}
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
								<div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-300 px-4 py-3 text-sm dark:border-stone-700">
									<p className="text-stone-600 tabular-nums dark:text-stone-400">
										{t("naytetaanMaara", "Näytetään {{shown}} / {{total}}", {
											shown: visiblePending.length,
											total: filteredPending.length,
										})}
									</p>
									{visiblePending.length < filteredPending.length && (
										<Button
											variant="outline"
											size="sm"
											onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
										>
											{t("naytaLisaa", "Näytä lisää")}
										</Button>
									)}
								</div>
							</>
						) : (
							<div className="px-4 pb-4">
								{onlyConflicts ? (
									<EmptyState
										title={t("eiRistiriitaisia", "Ei ristiriitaisia varauksia")}
										action={
											<Button
												variant="outline"
												size="sm"
												onClick={() => setOnlyConflicts(false)}
											>
												{t("naytaKaikki", "Näytä kaikki")}
											</Button>
										}
									>
										{t(
											"eiRistiriitaisiaKuvaus",
											"Päällekkäisiä pyyntöjä ei ole.",
										)}
									</EmptyState>
								) : (
									<EmptyState
										icon={Check}
										title={t("eiOdottaviaVarauksia", "Ei odottavia varauksia")}
									>
										{t(
											"eiOdottaviaVarauksiaKuvaus",
											"Ei käsiteltäviä pyyntöjä valitulla aikavälillä. Voit vaihtaa aikaväliä tai suodattimia.",
										)}
									</EmptyState>
								)}
							</div>
						)}

						{activeSelected.length > 0 && (
							<div className="sticky bottom-0 z-30 flex flex-wrap items-center gap-2 rounded-b-sm border-t-2 border-stone-800 bg-stone-100 px-4 py-3 dark:border-stone-300 dark:bg-stone-800">
								<span className="mr-auto text-sm font-medium">
									{t("valittuMaara", "{{count}} valittu", {
										count: activeSelected.length,
									})}
								</span>
								<Button
									variant="ghost"
									size="sm"
									disabled={bulkBusy}
									onClick={() => setSelectedIds(new Set())}
								>
									{t("tyhjennaValinta", "Tyhjennä valinta")}
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
									size="sm"
									disabled={bulkBusy}
									onClick={handleBulkApprove}
								>
									{bulkBusy ? (
										<Loader2 size={14} className="animate-spin" />
									) : (
										<Check size={14} aria-hidden="true" />
									)}
									{t("hyvaksyValitutMaara", "Hyväksy valitut ({{count}})", {
										count: activeSelected.length,
									})}
								</Button>
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
