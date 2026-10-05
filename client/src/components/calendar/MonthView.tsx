// src/components/calendar/MonthView.tsx

import { Link } from "@tanstack/react-router";
import { AlertOctagon, CalendarCheck, Clock } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	type CalendarEvent,
	type DaySegment,
	splitEventsByDay,
} from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";
import {
	addDays,
	formatDateTimeLocal,
	monthGridRange,
	useDateFormatter,
} from "#/utils/date";

interface MonthViewProps {
	/** First day of the shown month */
	monthStart: Date;
	events: CalendarEvent[];
	/** Opens the given day in the day view */
	onDayClick?: (date: Date) => void;
}

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** One reservation or restriction as a single line in a day's list */
function MonthEventItem({ event }: { event: DaySegment }) {
	const { t } = useTranslation();
	const { formatTime, formatDateRange } = useDateFormatter();
	const isRestriction = Boolean(event.isRestriction);
	const isBlock = Boolean(event.isBlock);
	const isPending = event.status === "pending";
	// A segment carried over from the previous day has no start time of its own on this day
	const timeLabel = event.continuesBefore ? "…" : formatTime(event.start);
	const timeString = formatDateRange(event.eventStart, event.eventEnd);

	const tooltipText = `${event.resourceName ? `${event.resourceName}: ` : ""}${event.title}${isPending ? ` [${t("odottaa", "Odottaa")}]` : ""}${event.userName ? ` [${event.userName}]` : ""} (${timeString})`;

	const className = cn(
		"flex items-center gap-1 min-w-0 rounded-xs border px-1 text-[11px] leading-4 hover:underline",
		isBlock
			? "bg-emerald-50 dark:bg-emerald-950/50 border-dashed border-emerald-500 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/70"
			: isRestriction
				? "bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-700 text-amber-900 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-900"
				: isPending
					? "bg-purple-50/70 dark:bg-purple-950/40 border-dashed border-purple-400 dark:border-purple-600 text-stone-900 dark:text-stone-100 hover:bg-purple-100 dark:hover:bg-purple-900/60"
					: "bg-stone-200 dark:bg-stone-800 border-stone-400 dark:border-stone-600 text-stone-900 dark:text-stone-100 hover:bg-stone-300 dark:hover:bg-stone-700",
	);

	// In narrow day cells the title gets the whole line and may wrap; the time and icon would
	// leave no room for it, and the colours and the tooltip still tell the rest
	const content = (
		<>
			{isBlock ? (
				<CalendarCheck
					size={10}
					className="text-emerald-600 shrink-0 @max-[7rem]:hidden"
				/>
			) : isRestriction ? (
				<AlertOctagon
					size={10}
					className="text-amber-600 shrink-0 @max-[7rem]:hidden"
				/>
			) : (
				isPending && (
					<Clock
						size={10}
						className="text-purple-600 dark:text-purple-400 shrink-0 @max-[7rem]:hidden"
					/>
				)
			)}
			<span className="font-mono text-[10px] text-stone-500 dark:text-stone-400 shrink-0 @max-[7rem]:hidden">
				{timeLabel}
			</span>
			<span className="font-semibold truncate @max-[7rem]:whitespace-normal @max-[7rem]:line-clamp-2 @max-[7rem]:wrap-break-word">
				{event.title}
			</span>
		</>
	);

	return isBlock ? (
		<Link
			to="/reservations/create"
			search={{
				start_time: formatDateTimeLocal(event.eventStart),
				end_time: formatDateTimeLocal(event.eventEnd),
				resource_ids: [event.resourceId],
			}}
			className={className}
			title={tooltipText}
		>
			{content}
		</Link>
	) : isRestriction ? (
		<Link
			to="/restrictions/$id"
			params={{ id: event.restrictionId || "" }}
			className={className}
			title={tooltipText}
		>
			{content}
		</Link>
	) : (
		<Link
			to="/reservations/$id"
			params={{ id: event.reservationId || "" }}
			className={className}
			title={tooltipText}
		>
			{content}
		</Link>
	);
}

export function MonthView({ monthStart, events, onDayClick }: MonthViewProps) {
	const { formatWeekdayShort } = useDateFormatter();
	const { start, days } = useMemo(
		() => monthGridRange(monthStart),
		[monthStart],
	);
	const weeks = days / 7;
	const today = new Date();

	// Every event is listed on each day it touches, in start order regardless of its length
	const eventsByDay = useMemo(
		() =>
			splitEventsByDay(events, start, days).map((segments) =>
				[...segments].sort(
					(a, b) =>
						a.start.getTime() - b.start.getTime() ||
						a.eventStart.getTime() - b.eventStart.getTime(),
				),
			),
		[events, start, days],
	);

	return (
		<div className="flex-1 min-h-0 overflow-auto border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-950">
			<div
				className="grid min-h-full min-w-full divide-x divide-y divide-stone-200 dark:divide-stone-800"
				style={{
					gridTemplateColumns: "repeat(7, minmax(2.75rem, 1fr))",
					gridTemplateRows: `2rem repeat(${weeks}, minmax(6rem, 1fr))`,
				}}
			>
				{/* Weekday headers */}
				{Array.from({ length: 7 }, (_, i) => {
					const weekday = formatWeekdayShort(addDays(start, i));
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Weekday columns are static
							key={`weekday-${i}`}
							className="sticky top-0 z-30 flex items-center justify-center bg-stone-100 dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 text-xs font-bold truncate"
						>
							{weekday.charAt(0).toUpperCase() + weekday.slice(1)}
						</div>
					);
				})}

				{/* Day cells */}
				{eventsByDay.map((dayEvents, i) => {
					const date = addDays(start, i);
					const isOtherMonth = date.getMonth() !== monthStart.getMonth();
					const isToday = isSameDay(date, today);

					return (
						<div
							key={date.getTime()}
							className={cn(
								"flex flex-col gap-0.5 min-w-0 min-h-0 p-1 overflow-hidden",
								isOtherMonth
									? "bg-stone-100/60 dark:bg-stone-950"
									: "bg-stone-50 dark:bg-stone-900/40",
							)}
						>
							<button
								type="button"
								onClick={() => onDayClick?.(date)}
								className={cn(
									"self-start shrink-0 min-w-5 h-5 px-1 rounded-full text-[11px] font-semibold leading-5 text-center hover:bg-purple-100 dark:hover:bg-purple-950/60",
									isToday
										? "bg-rose-500 text-white dark:bg-rose-500 hover:bg-rose-600 dark:hover:bg-rose-600"
										: isOtherMonth
											? "text-stone-400 dark:text-stone-600"
											: "text-stone-700 dark:text-stone-300",
								)}
							>
								{date.getDate()}
							</button>

							<div className="@container flex flex-col gap-0.5 min-h-0 overflow-y-auto no-scrollbar">
								{dayEvents.map((evt) => (
									<MonthEventItem key={evt.id} event={evt} />
								))}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
