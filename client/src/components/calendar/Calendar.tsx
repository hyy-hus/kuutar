// src/components/calendar/Calendar.tsx

import { Link, useNavigate } from "@tanstack/react-router";
import {
	CalendarDays,
	ChevronLeft,
	ChevronRight,
	Columns3,
	Loader2,
	Plus,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { useReservations } from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useRestrictions } from "#/hooks/useRestrictions";
import type { CalendarSearch, CalendarViewMode } from "#/routes/_app/calendar";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";
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
import { ToggleChip } from "../Chip";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

interface CalendarProps {
	startStr: string;
	view: CalendarViewMode;
	/** Number of day columns in the days view */
	days: number;
	selectedResourceIds?: string[];
	onSearchChange: (nextSearch: CalendarSearch) => void;
}

/** Shared look of the toolbar's inputs and selects, matching the "field" button variant */
const FIELD_CLASS =
	"h-8 px-2 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md font-medium";

/** Height of one hour row in rem, from most compact to roomiest */
const HOUR_HEIGHTS = [3, 5, 7] as const;
type HourHeight = (typeof HOUR_HEIGHTS)[number];
const DEFAULT_HOUR_HEIGHT: HourHeight = 5;
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

	const { data: resources, isLoading: loadingResources } = useResources();

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

	const viewModes: {
		mode: CalendarViewMode;
		label: string;
		icon: typeof CalendarDays;
	}[] = [
		{ mode: "days", label: t("pivt", "Päivät"), icon: Columns3 },
		{ mode: "month", label: t("kuukausi", "Kuukausi"), icon: CalendarDays },
	];

	const toggleResource = (id: string) => {
		const nextResources = activeResourceIds.includes(id)
			? activeResourceIds.filter((item) => item !== id)
			: [...activeResourceIds, id];

		onSearchChange({ resources: nextResources });
	};

	const handleDayClick = (date: Date) => {
		onSearchChange({ view: "days", days: 1, start: formatYYYYMMDD(date) });
	};

	const handleSlotDoubleClick = (startTime: string, endTime: string) => {
		navigate({
			to: "/reservations/create",
			search: {
				start_time: startTime,
				end_time: endTime,
				resource_ids: activeResourceIds.length > 1 ? [] : activeResourceIds,
			},
		});
	};

	const calendarEvents = useMemo(() => {
		if (!resources) return [];

		const resourcesMap = new Map(resources.map((r) => [r.id, r.name]));
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

		// Deduplicate
		const uniqueEvents = new Map<string, CalendarEvent>();
		events.forEach((evt) => {
			const key = evt.isRestriction
				? `restr_${evt.restrictionId}_${evt.start.getTime()}_${evt.end.getTime()}`
				: `res_${evt.reservationId}_${evt.start.getTime()}_${evt.end.getTime()}`;

			if (!uniqueEvents.has(key)) {
				uniqueEvents.set(key, evt);
			}
		});

		return Array.from(uniqueEvents.values());
	}, [reservations, restrictions, resources, activeResourceIds]);

	if (loadingResources || loadingReservations || loadingRestrictions) {
		return (
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanKalenteria", "Ladataan kalenteria...")}</span>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3 p-1 md:p-2 h-full min-h-0 min-w-0">
			{/* Header & New Reservation Button */}
			<div className="flex items-center justify-between gap-2 shrink-0">
				<h1 className="text-lg md:text-xl font-bold tracking-tight">
					{t("kalenteri", "Kalenteri")}
				</h1>

				<Button asChild size="sm" className="gap-1.5 shrink-0">
					<Link to="/reservations/create">
						<Plus size={16} />
						<span>{t("uusiVaraus", "Uusi varaus")}</span>
					</Link>
				</Button>
			</div>

			{/* Controls Bar: the groups wrap onto their own lines on narrow screens */}
			<div className="flex flex-wrap items-center gap-2 shrink-0 bg-stone-100 dark:bg-stone-900 p-2 rounded-md border border-stone-200 dark:border-stone-800">
				<div className="flex items-center gap-1">
					<Button
						variant="field"
						size="iconSm"
						onClick={() => moveStart(-1)}
						aria-label={t("edellinenJakso", "Edellinen jakso")}
					>
						<ChevronLeft size={16} />
					</Button>

					<input
						type="date"
						value={formatYYYYMMDD(start)}
						// The input value is already YYYY-MM-DD; valueAsDate would be UTC midnight
						onChange={(e) =>
							e.target.value && onSearchChange({ start: e.target.value })
						}
						className={cn(FIELD_CLASS, "font-mono")}
					/>

					<Button
						variant="field"
						size="iconSm"
						onClick={() => moveStart(1)}
						aria-label={t("seuraavaJakso", "Seuraava jakso")}
					>
						<ChevronRight size={16} />
					</Button>
				</div>

				<div className="flex flex-wrap items-center gap-1">
					<fieldset
						aria-label={t("nkym", "Näkymä")}
						className="flex h-8 rounded-md border border-stone-300 dark:border-stone-700 overflow-hidden"
					>
						{viewModes.map(({ mode, label, icon: Icon }) => {
							const isActive = mode === view;
							return (
								<button
									key={mode}
									type="button"
									onClick={() => handleViewChange(mode)}
									aria-pressed={isActive}
									title={label}
									className={cn(
										"flex items-center gap-1 px-2 text-xs font-medium cursor-pointer transition-colors",
										isActive
											? "bg-stone-900 text-stone-50 dark:bg-stone-100 dark:text-stone-900"
											: "bg-stone-50 dark:bg-stone-950 hover:bg-stone-200 dark:hover:bg-stone-800",
									)}
								>
									<Icon size={14} className="shrink-0" />
									<span className="hidden md:inline">{label}</span>
								</button>
							);
						})}
					</fieldset>

					{isMonth ? (
						<span className="text-sm font-semibold capitalize">
							{formatMonthYear(start)}
						</span>
					) : (
						<>
							<select
								value={days}
								onChange={(e) => handleDaysChange(Number(e.target.value))}
								className={FIELD_CLASS}
							>
								<option value={1}>{t("1Piv", "1 päivä")}</option>
								<option value={3}>{t("3Piv", "3 päivää")}</option>
								<option value={5}>{t("5Piv", "5 päivää")}</option>
								<option value={7}>{t("1Viikko", "1 viikko")}</option>
							</select>

							<select
								value={hourHeight}
								onChange={(e) =>
									handleHourHeightChange(Number(e.target.value) as HourHeight)
								}
								aria-label={t("tuntirivinKorkeus", "Tuntirivin korkeus")}
								className={FIELD_CLASS}
							>
								<option value={3}>{t("tiivis", "Tiivis")}</option>
								<option value={5}>{t("normaali", "Normaali")}</option>
								<option value={7}>{t("vlj", "Väljä")}</option>
							</select>
						</>
					)}
				</div>
			</div>

			{/* Scrollable Resource Chips */}
			<div className="flex gap-1.5 shrink-0 overflow-x-auto pb-1.5 no-scrollbar border-b border-stone-200 dark:border-stone-800">
				{resources?.map((res) => {
					const isSelected = activeResourceIds.includes(res.id);
					return (
						<div key={res.id} className="shrink-0">
							<ToggleChip
								selected={isSelected}
								onClick={() => toggleResource(res.id)}
							>
								{res.name}
							</ToggleChip>
						</div>
					);
				})}
			</div>

			{/* Main Calendar View */}
			{isMonth ? (
				<MonthView
					monthStart={start}
					events={calendarEvents}
					onDayClick={handleDayClick}
				/>
			) : (
				<WeekView
					start={start}
					days={days}
					hourHeightRem={hourHeight}
					events={calendarEvents}
					onSlotDoubleClick={handleSlotDoubleClick}
				/>
			)}
		</div>
	);
}
