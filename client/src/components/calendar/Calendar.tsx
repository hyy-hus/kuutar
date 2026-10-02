// src/components/calendar/Calendar.tsx

import { Link, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Loader2, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { useReservations } from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useRestrictions } from "#/hooks/useRestrictions";
import type { CalendarSearch } from "#/routes/_app/calendar";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { ToggleChip } from "../Chip";
import { WeekView } from "./WeekView";

interface CalendarProps {
	startStr: string;
	days: number;
	selectedResourceIds?: string[];
	onSearchChange: (nextSearch: CalendarSearch) => void;
}

const parseLocalDate = (dateStr: string): Date => {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const formatYYYYMMDD = (d: Date): string => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

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

const getMonday = (d: Date): Date => {
	const target = new Date(d);
	const day = target.getDay();
	const diff = target.getDate() - day + (day === 0 ? -6 : 1);
	return new Date(target.setDate(diff));
};

export function Calendar({
	startStr,
	days,
	selectedResourceIds,
	onSearchChange,
}: CalendarProps) {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const start = useMemo(() => parseLocalDate(startStr), [startStr]);
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

	useEffect(() => {
		if (window.innerWidth < 640 && days > 1 && !selectedResourceIds) {
			onSearchChange({ days: 1, start: formatYYYYMMDD(start) });
		}
	}, [days, onSearchChange, selectedResourceIds, start]);

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

	const moveStart = (deltaDays: number) => {
		const next = new Date(start);
		next.setDate(next.getDate() + deltaDays);
		onSearchChange({ start: formatYYYYMMDD(next) });
	};

	const handleDaysChange = (newDays: number) => {
		if (newDays === 7) {
			onSearchChange({ days: 7, start: formatYYYYMMDD(getMonday(start)) });
		} else {
			onSearchChange({ days: newDays, start: formatYYYYMMDD(start) });
		}
	};

	const toggleResource = (id: string) => {
		const nextResources = activeResourceIds.includes(id)
			? activeResourceIds.filter((item) => item !== id)
			: [...activeResourceIds, id];

		onSearchChange({ resources: nextResources });
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

			{/* Controls Bar */}
			<div className="flex flex-wrap items-center justify-between gap-2 shrink-0 bg-stone-100 dark:bg-stone-900 p-2 rounded-md border border-stone-200 dark:border-stone-800">
				<div className="flex items-center gap-1.5 shrink-0 w-full sm:w-auto justify-between sm:justify-start">
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
								onSearchChange({ start: formatYYYYMMDD(e.target.valueAsDate) })
							}
							className="px-2 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md font-mono"
						/>

						<Button
							variant="secondary"
							size="sm"
							onClick={() => moveStart(days)}
						>
							<ChevronRight size={16} />
						</Button>
					</div>

					<select
						value={days}
						onChange={(e) => handleDaysChange(Number(e.target.value))}
						className="px-2 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md font-medium"
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
						className="px-2 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md font-medium"
					>
						<option value={3}>{t("tiivis", "Tiivis")}</option>
						<option value={5}>{t("normaali", "Normaali")}</option>
						<option value={7}>{t("vlj", "Väljä")}</option>
					</select>
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
			<WeekView
				start={start}
				days={days}
				hourHeightRem={hourHeight}
				events={calendarEvents}
				onSlotDoubleClick={handleSlotDoubleClick}
			/>
		</div>
	);
}
