// src/components/calendar/Calendar.tsx

import { Link, useNavigate } from "@tanstack/react-router";
import {
	ChevronLeft,
	ChevronRight,
	ListChecks,
	Loader2,
	Plus,
	Rows2,
	Rows3,
	Rows4,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { useIsAdmin } from "#/hooks/useAuth";
import { useReservableBlocks } from "#/hooks/useReservableBlocks";
import { useReservations } from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useRestrictions } from "#/hooks/useRestrictions";
import type { CalendarSearch, CalendarViewMode } from "#/routes/_app/calendar";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";
import { getCollectionIcon } from "#/utils/collectionIcons";
import {
	addDays,
	formatYYYYMMDD,
	localDayRangeISO,
	monthGridRange,
	parseLocalDate,
	startOfMonth,
	startOfWeek,
	useDateFormatter,
} from "#/utils/date";
import { addMinutes, resolveDefaultDuration } from "#/utils/duration";
import { getContrastColor, getResourceHex } from "#/utils/resourceColors";
import { ToggleChip } from "../Chip";
import { DateInput } from "../DateInput";
import { FilterBar } from "../FilterBar";
import { PageHeader } from "../PageHeader";
import { SegmentedControl } from "../SegmentedControl";
import { Select } from "../Select";
import { AgendaView } from "./AgendaView";
import { MonthView } from "./MonthView";
import { useIsMobile } from "./useIsMobile";
import { WeekView } from "./WeekView";

interface CalendarProps {
	startStr: string;
	view: CalendarViewMode;
	/** Number of day columns in the days view */
	days: number;
	selectedResourceIds?: string[];
	onSearchChange: (nextSearch: CalendarSearch) => void;
}

/** Height of one hour row in rem, from most compact to roomiest */
const HOUR_HEIGHTS = [3, 5, 7] as const;
type HourHeight = (typeof HOUR_HEIGHTS)[number];
const DEFAULT_HOUR_HEIGHT: HourHeight = 5;
/** Icon for each row height: more rows for more compact */
const HOUR_HEIGHT_ICONS = { 3: Rows4, 5: Rows3, 7: Rows2 } as const;
const HOUR_HEIGHT_STORAGE_KEY = "kuutar.calendar.hourHeight";

/** Reads the remembered row height; storage can be unavailable (e.g. private mode) */
function readStoredHourHeight(): HourHeight {
	try {
		const stored = Number(localStorage.getItem(HOUR_HEIGHT_STORAGE_KEY));
		return HOUR_HEIGHTS.find((h) => h === stored) ?? DEFAULT_HOUR_HEIGHT;
	} catch {
		return DEFAULT_HOUR_HEIGHT;
	}
}

export function Calendar({
	startStr,
	view,
	days,
	selectedResourceIds,
	onSearchChange,
}: CalendarProps) {
	const { t } = useTranslation();
	const { formatMonthYear } = useDateFormatter();
	const navigate = useNavigate();
	const isMobile = useIsMobile();
	const isMonth = view === "month";
	// The month view always shows the whole month containing the start date
	const start = useMemo(() => {
		const date = parseLocalDate(startStr);
		return isMonth ? startOfMonth(date) : date;
	}, [startStr, isMonth]);
	const [hourHeight, setHourHeight] = useState(readStoredHourHeight);

	const handleHourHeightChange = (next: HourHeight) => {
		setHourHeight(next);
		try {
			localStorage.setItem(HOUR_HEIGHT_STORAGE_KEY, String(next));
		} catch {
			// Not persisting is fine; it just resets on reload
		}
	};

	/** Steps through the row heights, from compact to roomy and back */
	const cycleHourHeight = () => {
		const index = HOUR_HEIGHTS.indexOf(hourHeight);
		handleHourHeightChange(HOUR_HEIGHTS[(index + 1) % HOUR_HEIGHTS.length]);
	};
	const HourHeightIcon = HOUR_HEIGHT_ICONS[hourHeight];
	const hourHeightNames: Record<HourHeight, string> = {
		3: t("tiivis", "Tiivis"),
		5: t("normaali", "Normaali"),
		7: t("vlj", "Väljä"),
	};
	const hourHeightLabel = `${t("tuntirivinKorkeus", "Tuntirivin korkeus")}: ${hourHeightNames[hourHeight]}`;

	const { data: resources, isLoading: loadingResources } = useResources();
	const { isAdmin } = useIsAdmin();

	const activeResourceIds = useMemo(() => {
		if (selectedResourceIds && selectedResourceIds.length > 0) {
			return selectedResourceIds;
		}
		return resources?.map((r) => r.id) || [];
	}, [selectedResourceIds, resources]);

	useEffect(() => {
		if (resources && selectedResourceIds === undefined) {
			onSearchChange({ resources: resources.map((r) => r.id) });
		}
	}, [resources, selectedResourceIds, onSearchChange]);

	// Exactly the visible days, in local time; the month grid also shows the edges of its neighbours
	const { startISO: startDateISO, endISO: endDateISO } = useMemo(() => {
		const visible = isMonth ? monthGridRange(start) : { start, days };
		return localDayRangeISO(
			visible.start,
			addDays(visible.start, visible.days - 1),
		);
	}, [start, days, isMonth]);

	const { data: reservations, isLoading: loadingReservations } =
		useReservations({
			startDate: startDateISO,
			endDate: endDateISO,
		});

	const { data: restrictions, isLoading: loadingRestrictions } =
		useRestrictions({
			start_date: startDateISO,
			end_date: endDateISO,
		});

	const { data: reservableBlocks, isLoading: loadingBlocks } =
		useReservableBlocks({
			start_date: startDateISO,
			end_date: endDateISO,
		});

	/** Steps back or forward by the shown range: a whole month, or the number of days */
	const moveStart = (direction: 1 | -1) => {
		const next = isMonth
			? new Date(start.getFullYear(), start.getMonth() + direction, 1)
			: addDays(start, days * direction);
		onSearchChange({ start: formatYYYYMMDD(next) });
	};

	const handleViewChange = (nextView: CalendarViewMode) => {
		if (nextView === view) return;
		if (nextView === "month") {
			onSearchChange({
				view: "month",
				start: formatYYYYMMDD(startOfMonth(start)),
			});
		} else {
			// Back from a month: show this month's days around today, or from the 1st of another month
			const today = new Date();
			const inShownMonth =
				today.getFullYear() === start.getFullYear() &&
				today.getMonth() === start.getMonth();
			const dayStart = inShownMonth ? today : start;
			onSearchChange({
				view: "days",
				start: formatYYYYMMDD(days === 7 ? startOfWeek(dayStart) : dayStart),
			});
		}
	};

	const handleDaysChange = (newDays: number) => {
		if (newDays === 7) {
			onSearchChange({ days: 7, start: formatYYYYMMDD(startOfWeek(start)) });
		} else {
			onSearchChange({ days: newDays, start: formatYYYYMMDD(start) });
		}
	};

	/** Jumps to the period containing today, keeping the current view and length */
	const goToToday = () => {
		const today = new Date();
		onSearchChange({
			start: formatYYYYMMDD(
				isMonth ? startOfMonth(today) : days === 7 ? startOfWeek(today) : today,
			),
		});
	};

	const toggleResource = (id: string) => {
		const nextResources = activeResourceIds.includes(id)
			? activeResourceIds.filter((item) => item !== id)
			: [...activeResourceIds, id];

		onSearchChange({ resources: nextResources });
	};

	const allResourceIds = resources?.map((r) => r.id) ?? [];
	const allSelected =
		allResourceIds.length > 0 &&
		allResourceIds.every((id) => activeResourceIds.includes(id));

	/** Shows only this resource; the "All" chip brings the rest back */
	const soloResource = (id: string) => onSearchChange({ resources: [id] });

	const handleDayClick = (date: Date) => {
		onSearchChange({ view: "days", days: 1, start: formatYYYYMMDD(date) });
	};

	const handleSlotDoubleClick = (startTime: string, endTime: string) => {
		// Blocks-only resources can't be reserved at an arbitrary slot, and restricted
		// ones only by granted groups (admins excepted)
		const slotResourceIds = isAdmin
			? activeResourceIds
			: activeResourceIds.filter((id) => {
					const res = resources?.find((r) => r.id === id);
					return !res?.blocks_only && res?.can_reserve !== false;
				});
		const resourceIds = slotResourceIds.length > 1 ? [] : slotResourceIds;
		// A single resource's default duration replaces the grid's one-hour slot
		const defaultMinutes = resolveDefaultDuration(
			resources?.filter((r) => resourceIds.includes(r.id)) ?? [],
		);
		navigate({
			to: "/reservations/create",
			search: {
				start_time: startTime,
				end_time: defaultMinutes
					? addMinutes(startTime, defaultMinutes)
					: endTime,
				resource_ids: resourceIds,
			},
		});
	};

	const calendarEvents = useMemo(() => {
		if (!resources) return [];

		const resourcesMap = new Map(resources.map((r) => [r.id, r.name]));
		const colorsMap = new Map(
			resources.map((r) => [r.id, r.color ?? undefined]),
		);
		const events: CalendarEvent[] = [];

		// 1. Process Reservations
		if (reservations) {
			reservations.forEach((res) => {
				if (res.status === "cancelled") return;
				if (!res.occurrences || res.occurrences.length === 0) return;

				const timeGroups = new Map<string, typeof res.occurrences>();

				res.occurrences.forEach((occ) => {
					if (activeResourceIds.includes(occ.resource_id)) {
						const startMs = new Date(occ.start_time).getTime();
						const endMs = new Date(occ.end_time).getTime();
						const key = `${res.id}_${startMs}_${endMs}`;

						const group = timeGroups.get(key) || [];
						group.push(occ);
						timeGroups.set(key, group);
					}
				});

				timeGroups.forEach((occurrencesGroup) => {
					const resourceNames = Array.from(
						new Set(
							occurrencesGroup
								.map((occ) => resourcesMap.get(occ.resource_id))
								.filter(Boolean),
						),
					).join(", ");

					const firstOcc = occurrencesGroup[0];

					events.push({
						id: firstOcc.id,
						reservationId: res.id,
						status: res.status, // Passed down to ReservationBlock
						isRestriction: false,
						title: res.title,
						start: new Date(firstOcc.start_time),
						end: new Date(firstOcc.end_time),
						resourceId: firstOcc.resource_id,
						resourceName: resourceNames,
						resourceColor: colorsMap.get(firstOcc.resource_id),
						userName: res.user_name ?? undefined,
					});
				});
			});
		}

		// 2. Process Restrictions (global or specific resource bindings)
		if (restrictions && activeResourceIds.length > 0) {
			restrictions.forEach((restrWithOcc) => {
				const occurrences = restrWithOcc.occurrences || [];
				const timeGroups = new Map<
					string,
					{
						occ: (typeof occurrences)[0];
						isGlobal: boolean;
						resourceNames: Set<string>;
					}
				>();

				occurrences.forEach((occ) => {
					const resId = occ.resource_id;
					const isGlobal = !resId;
					if (isGlobal || (resId && activeResourceIds.includes(resId))) {
						const startMs = new Date(occ.start_time).getTime();
						const endMs = new Date(occ.end_time).getTime();
						const key = `${restrWithOcc.id}_${startMs}_${endMs}`;

						const entry = timeGroups.get(key) || {
							occ,
							isGlobal: false,
							resourceNames: new Set<string>(),
						};

						if (isGlobal) {
							entry.isGlobal = true;
						} else if (resId) {
							const name = resourcesMap.get(resId);
							if (name) entry.resourceNames.add(name);
						}

						timeGroups.set(key, entry);
					}
				});

				timeGroups.forEach((entry) => {
					const resourceName = entry.isGlobal
						? undefined
						: Array.from(entry.resourceNames).join(", ");

					events.push({
						id: `restr-${entry.occ.id}`,
						restrictionId: restrWithOcc.id,
						isRestriction: true,
						title: restrWithOcc.title,
						start: new Date(entry.occ.start_time),
						end: new Date(entry.occ.end_time),
						resourceId: entry.occ.resource_id ?? "",
						resourceName,
					});
				});
			});
		}

		// 3. Process free reservable blocks, which are clickable to reserve
		if (reservableBlocks) {
			reservableBlocks.forEach((block) => {
				block.occurrences.forEach((occ) => {
					if (occ.reserved || !activeResourceIds.includes(occ.resource_id)) {
						return;
					}
					events.push({
						id: `block-${occ.id}`,
						blockId: block.id,
						isBlock: true,
						title: block.title,
						start: new Date(occ.start_time),
						end: new Date(occ.end_time),
						resourceId: occ.resource_id,
						resourceName: resourcesMap.get(occ.resource_id),
						resourceColor: colorsMap.get(occ.resource_id),
					});
				});
			});
		}

		// Deduplicate
		const uniqueEvents = new Map<string, CalendarEvent>();
		events.forEach((evt) => {
			const key = evt.isBlock
				? evt.id
				: evt.isRestriction
					? `restr_${evt.restrictionId}_${evt.start.getTime()}_${evt.end.getTime()}`
					: `res_${evt.reservationId}_${evt.start.getTime()}_${evt.end.getTime()}`;

			if (!uniqueEvents.has(key)) {
				uniqueEvents.set(key, evt);
			}
		});

		return Array.from(uniqueEvents.values());
	}, [
		reservations,
		restrictions,
		reservableBlocks,
		resources,
		activeResourceIds,
	]);

	if (
		loadingResources ||
		loadingReservations ||
		loadingRestrictions ||
		loadingBlocks
	) {
		return (
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanKalenteria", "Ladataan kalenteria...")}</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 h-full min-h-0 min-w-0 w-full max-w-7xl">
			<PageHeader
				title={t("kalenteri", "Kalenteri")}
				actions={
					<Button asChild size="md" className="gap-1.5 shrink-0">
						<Link to="/reservations/create">
							<Plus size={16} />
							<span>{t("uusiVaraus", "Uusi varaus")}</span>
						</Link>
					</Button>
				}
			/>

			{/* Period navigation, then view and length, as on the other period pages */}
			<FilterBar className="shrink-0">
				<div className="flex items-center gap-1">
					<Button
						variant="outline"
						size="iconSm"
						onClick={() => moveStart(-1)}
						aria-label={t("edellinenJakso", "Edellinen jakso")}
						title={t("edellinenJakso", "Edellinen jakso")}
					>
						<ChevronLeft size={16} />
					</Button>

					<DateInput
						size="sm"
						aria-label={t("jaksonAlku", "Jakson alku")}
						value={formatYYYYMMDD(start)}
						// The input value is already YYYY-MM-DD; valueAsDate would be UTC midnight
						onChange={(e) =>
							e.target.value && onSearchChange({ start: e.target.value })
						}
						className="w-auto tabular-nums"
					/>

					<Button
						variant="outline"
						size="iconSm"
						onClick={() => moveStart(1)}
						aria-label={t("seuraavaJakso", "Seuraava jakso")}
						title={t("seuraavaJakso", "Seuraava jakso")}
					>
						<ChevronRight size={16} />
					</Button>

					<Button variant="outline" size="sm" onClick={goToToday}>
						{t("tnn", "Tänään")}
					</Button>
				</div>

				<SegmentedControl
					aria-label={t("nkym", "Näkymä")}
					value={view}
					onChange={handleViewChange}
					options={[
						{ value: "days", label: t("pivt", "Päivät") },
						{ value: "month", label: t("kuukausi", "Kuukausi") },
					]}
				/>

				{isMonth ? (
					<span className="text-sm font-semibold capitalize whitespace-nowrap">
						{formatMonthYear(start)}
					</span>
				) : (
					<>
						<div className="flex items-center gap-2">
							<label
								htmlFor="calendar-days"
								className="hidden md:inline text-xs font-medium"
							>
								{t("jaksonPituus", "Jakson pituus")}
							</label>
							<Select
								id="calendar-days"
								size="sm"
								wrapperClassName="w-auto"
								value={days}
								onChange={(e) => handleDaysChange(Number(e.target.value))}
							>
								<option value={1}>{t("1Piv", "1 päivä")}</option>
								<option value={3}>{t("3Piv", "3 päivää")}</option>
								<option value={5}>{t("5Piv", "5 päivää")}</option>
								<option value={7}>{t("1Viikko", "1 viikko")}</option>
							</Select>
						</div>

						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={cycleHourHeight}
							aria-label={hourHeightLabel}
							title={hourHeightLabel}
						>
							<HourHeightIcon size={16} />
							<span className="hidden md:inline">
								{hourHeightNames[hourHeight]}
							</span>
						</Button>
					</>
				)}
			</FilterBar>

			{/* Resource filter: wraps instead of scrolling sideways, and scrolls within a capped height */}
			<fieldset
				aria-label={t("resurssit", "Resurssit")}
				className="flex flex-wrap gap-1.5 shrink-0 max-h-24 overflow-y-auto"
			>
				<ToggleChip
					selected={allSelected}
					onClick={() => onSearchChange({ resources: allResourceIds })}
				>
					<ListChecks size={12} aria-hidden="true" />
					{t("kaikki", "Kaikki")}
				</ToggleChip>
				{resources?.map((res) => {
					const isSelected = activeResourceIds.includes(res.id);
					const ResourceIcon = getCollectionIcon(res.collection_icon);
					return (
						<ToggleChip
							key={res.id}
							selected={isSelected}
							title={t(
								"vainTamaOhje",
								"Kaksoisnapsauta tai Ctrl-napsauta näyttääksesi vain tämän",
							)}
							onClick={(e) =>
								e.ctrlKey || e.metaKey || e.shiftKey
									? soloResource(res.id)
									: toggleResource(res.id)
							}
							onDoubleClick={() => soloResource(res.id)}
						>
							<span
								aria-hidden="true"
								className={cn(
									"size-4 rounded-full inline-flex items-center justify-center shrink-0 ring-1",
									isSelected
										? "ring-stone-50 dark:ring-stone-900"
										: "ring-stone-400 dark:ring-stone-600 opacity-70",
								)}
								style={{
									backgroundColor: getResourceHex(res.color),
									color: getContrastColor(getResourceHex(res.color)),
								}}
							>
								<ResourceIcon size={10} />
							</span>
							{res.name}
						</ToggleChip>
					);
				})}
			</fieldset>

			{/* Main Calendar View */}
			{isMonth ? (
				isMobile ? (
					<AgendaView monthStart={start} events={calendarEvents} />
				) : (
					<MonthView
						monthStart={start}
						events={calendarEvents}
						onDayClick={handleDayClick}
					/>
				)
			) : (
				<WeekView
					start={start}
					days={days}
					hourHeightRem={hourHeight}
					events={calendarEvents}
					onSlotDoubleClick={handleSlotDoubleClick}
				/>
			)}

			<CalendarLegend showSlots={!isMonth} />
		</div>
	);
}

/** Explains the look of pending reservations and, in the days view, free blocks and restrictions */
function CalendarLegend({ showSlots }: { showSlots: boolean }) {
	const { t } = useTranslation();
	const swatch = "inline-block h-3 w-5 rounded-xs border shrink-0";
	return (
		<ul
			aria-label={t("selite", "Selite")}
			className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-600 dark:text-stone-400 shrink-0"
		>
			<li className="flex items-center gap-1.5">
				<span
					aria-hidden="true"
					className={cn(
						swatch,
						"border-stone-400 bg-stone-200 dark:border-stone-600 dark:bg-stone-800",
					)}
				/>
				{t("vahvistettu", "Vahvistettu")}
			</li>
			<li className="flex items-center gap-1.5">
				<span
					aria-hidden="true"
					className={cn(
						swatch,
						"border-dashed border-purple-500 bg-purple-50 dark:border-purple-500 dark:bg-purple-950/40",
					)}
				/>
				{t("odottaaVahvistusta", "Odottaa vahvistusta")}
			</li>
			{showSlots && (
				<>
					<li className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className={cn(
								swatch,
								"border-dashed border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50",
							)}
						/>
						{t("vapaaVarausjakso", "Vapaa varausjakso")}
					</li>
					<li className="flex items-center gap-1.5">
						<span
							aria-hidden="true"
							className={cn(
								swatch,
								"border-amber-500 bg-amber-100 dark:bg-amber-950/80",
							)}
						/>
						{t("rajoitus", "Rajoitus")}
					</li>
				</>
			)}
		</ul>
	);
}
