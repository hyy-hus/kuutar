// src/components/calendar/MonthView.tsx

import { Link } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
	type CalendarEvent,
	compactEventsByDay,
	type DaySegment,
	splitOverflow,
} from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";
import { addDays, monthGridRange, useDateFormatter } from "#/utils/date";
import { getResourceColor } from "#/utils/resourceColors";

interface MonthViewProps {
	/** First day of the shown month */
	monthStart: Date;
	events: CalendarEvent[];
	/** Opens the given day in the day view */
	onDayClick?: (date: Date) => void;
}

/** Lines a day cell has room for; a longer list ends in a "+N more" link in the last line */
export const MAX_LINES_PER_DAY = 3;

/** Scroll offset of the month grid last left in this tab, so coming back from a reservation returns to it */
const SCROLL_STORAGE_KEY = "kuutar.calendar.monthScroll";

function readRememberedScroll(monthKey: string): number {
	try {
		const saved = JSON.parse(
			sessionStorage.getItem(SCROLL_STORAGE_KEY) ?? "{}",
		);
		return saved.month === monthKey && typeof saved.top === "number"
			? saved.top
			: 0;
	} catch {
		return 0;
	}
}

function rememberScroll(monthKey: string, top: number) {
	try {
		sessionStorage.setItem(
			SCROLL_STORAGE_KEY,
			JSON.stringify({ month: monthKey, top }),
		);
	} catch {
		// Not remembering is fine; the grid just opens at the top
	}
}

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/** One reservation as a single line in a day's list */
function MonthEventItem({ event }: { event: DaySegment }) {
	const { t } = useTranslation();
	const { formatTime, formatDateRange } = useDateFormatter();
	const isPending = event.status === "pending";
	const color = getResourceColor(event.resourceColor);
	// A segment carried over from the previous day has no start time of its own on this day
	const timeLabel = event.continuesBefore ? "…" : formatTime(event.start);
	const timeString = formatDateRange(event.eventStart, event.eventEnd);

	const tooltipText = `${event.resourceName ? `${event.resourceName}: ` : ""}${event.title}${isPending ? ` [${t("odottaa", "Odottaa")}]` : ""}${event.userName ? ` [${event.userName}]` : ""} (${timeString})`;

	const className = cn(
		"flex items-center gap-1 min-w-0 rounded-xs border px-1 text-xs leading-4 hover:underline",
		isPending
			? "bg-purple-50/70 dark:bg-purple-950/40 border-dashed border-purple-400 dark:border-purple-600 text-stone-900 dark:text-stone-100 hover:bg-purple-100 dark:hover:bg-purple-900/60"
			: cn(
					"border-stone-400 dark:border-stone-600 text-stone-900 dark:text-stone-100",
					color
						? color.tint
						: "bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700",
				),
		color && ["border-l-4", color.stripe],
	);

	// In narrow day cells the title gets the whole line and may wrap; the time and icon would
	// leave no room for it, and the colours and the tooltip still tell the rest
	return (
		<Link
			to="/reservations/$id"
			params={{ id: event.reservationId || "" }}
			className={className}
			style={color?.style}
			title={tooltipText}
		>
			{isPending && (
				<Clock
					size={10}
					className="text-purple-700 dark:text-purple-400 shrink-0 @max-[7rem]:hidden"
				/>
			)}
			<span className="tabular-nums text-stone-600 dark:text-stone-400 shrink-0 @max-[7rem]:hidden">
				{timeLabel}
			</span>
			<span className="font-semibold truncate @max-[7rem]:whitespace-normal @max-[7rem]:line-clamp-2 @max-[7rem]:wrap-break-word">
				{event.title}
			</span>
		</Link>
	);
}

export function MonthView({ monthStart, events, onDayClick }: MonthViewProps) {
	const { t } = useTranslation();
	const { formatWeekdayShort } = useDateFormatter();
	const { start, days } = useMemo(
		() => monthGridRange(monthStart),
		[monthStart],
	);
	const weeks = days / 7;
	const today = new Date();
	const scrollRef = useRef<HTMLDivElement>(null);
	const monthKey = `${monthStart.getFullYear()}-${monthStart.getMonth()}`;

	// The grid is rebuilt on every visit, so put it back where it was left; another month starts on top
	useLayoutEffect(() => {
		const scroller = scrollRef.current;
		if (scroller) scroller.scrollTop = readRememberedScroll(monthKey);
	}, [monthKey]);

	// Only existing reservations are listed; restrictions and bookable slots belong to the days view
	const eventsByDay = useMemo(
		() => compactEventsByDay(events, start, days),
		[events, start, days],
	);

	return (
		<div
			ref={scrollRef}
			onScroll={(e) => rememberScroll(monthKey, e.currentTarget.scrollTop)}
			className="flex-1 min-h-0 overflow-auto border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-950"
		>
			<div
				className="grid min-h-full min-w-full divide-x divide-y divide-stone-200 dark:divide-stone-800"
				style={{
					gridTemplateColumns: "repeat(7, minmax(2.75rem, 1fr))",
					gridTemplateRows: `2rem repeat(${weeks}, minmax(7.5rem, 1fr))`,
				}}
			>
				{/* Weekday headers */}
				{Array.from({ length: 7 }, (_, i) => {
					const weekday = formatWeekdayShort(addDays(start, i));
					return (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: Weekday columns are static
							key={`weekday-${i}`}
							className="sticky top-0 z-30 flex items-center justify-center bg-stone-100 dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 text-xs font-semibold truncate"
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
					const { visible, hidden } = splitOverflow(
						dayEvents,
						MAX_LINES_PER_DAY,
					);

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
									"focus-ring self-start shrink-0 min-w-6 h-6 px-1 rounded-full text-xs font-semibold leading-6 text-center tabular-nums hover:bg-purple-100 dark:hover:bg-purple-950/60",
									isToday
										? "bg-purple-700 text-white dark:bg-purple-500 hover:bg-purple-800 dark:hover:bg-purple-400"
										: isOtherMonth
											? "text-stone-500 dark:text-stone-500"
											: "text-stone-700 dark:text-stone-300",
								)}
							>
								{date.getDate()}
							</button>

							<div className="@container flex flex-col gap-0.5 min-h-0 overflow-hidden">
								{visible.map((evt) => (
									<MonthEventItem key={evt.id} event={evt} />
								))}
								{hidden > 0 && (
									<button
										type="button"
										onClick={() => onDayClick?.(date)}
										className="focus-ring text-left px-1 text-xs font-medium leading-4 text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
									>
										{t("plusNLisaa", "+{{count}} lisää", { count: hidden })}
									</button>
								)}
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
}
