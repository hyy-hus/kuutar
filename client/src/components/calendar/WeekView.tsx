// src/components/calendar/WeekView.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	type CalendarEvent,
	splitEventsByDay,
	todayColumnIndex,
} from "#/utils/calendarUtils";
import { formatDateTimeLocal, useDateFormatter } from "#/utils/date";
import { DayColumn } from "./DayColumn";

/** One sample timestamp per hour of the day, for the locale-formatted hour labels */
const hourDates = Array.from(
	{ length: 24 },
	(_, i) => new Date(2000, 0, 1, i, 0, 0, 0),
);

interface WeekViewProps {
	start: Date;
	days: number;
	/** Height of one hour row in rem */
	hourHeightRem: number;
	events: CalendarEvent[];
	onSlotDoubleClick?: (startTimeISO: string, endTimeISO: string) => void;
}

/** Current time, refreshed every minute */
function useNow(): Date {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 60000);
		return () => clearInterval(timer);
	}, []);
	return now;
}

/** Line at the current time, drawn inside today's column only */
function NowLine({ now }: { now: Date }) {
	const minutes = now.getHours() * 60 + now.getMinutes();
	return (
		<div
			data-testid="now-line"
			aria-hidden="true"
			className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
			style={{ top: `${(minutes / 1440) * 100}%` }}
		>
			<span className="-ml-1 size-2 shrink-0 rounded-full bg-purple-700 dark:bg-purple-400" />
			<span className="h-0.5 flex-1 bg-purple-700 dark:bg-purple-400" />
		</div>
	);
}

export function WeekView({
	start,
	days,
	hourHeightRem,
	events,
	onSlotDoubleClick,
}: WeekViewProps) {
	const { t } = useTranslation();
	const { formatTime, formatWeekdayShort, formatDayMonth } = useDateFormatter();
	const now = useNow();
	const todayColumn = todayColumnIndex(start, days, now);
	const hours = hourDates.map((d) => formatTime(d));
	const scrollRef = useRef<HTMLDivElement>(null);
	const [hoveredCell, setHoveredCell] = useState<{
		row: number;
		col: number;
	} | null>(null);

	const prevHourHeightRef = useRef<number | null>(null);

	useEffect(() => {
		const scroller = scrollRef.current;
		if (!scroller) return;
		const prevHourHeight = prevHourHeightRef.current;
		prevHourHeightRef.current = hourHeightRem;

		if (prevHourHeight === null) {
			// Start with the previous hour at the top, so the current hour is in view with some context.
			// The sticky 3rem header covers the area above the hour rows.
			const remPx = Number.parseFloat(
				getComputedStyle(document.documentElement).fontSize,
			);
			const firstHour = Math.max(0, new Date().getHours() - 1);
			scroller.scrollTop = firstHour * hourHeightRem * remPx;
		} else if (prevHourHeight !== hourHeightRem) {
			// Keep the same hour at the top when the row height changes
			scroller.scrollTop *= hourHeightRem / prevHourHeight;
		}
	}, [hourHeightRem]);

	const eventsByDay = useMemo(
		() => splitEventsByDay(events, start, days),
		[events, start, days],
	);

	const handleCellDoubleClick = (row: number, col: number) => {
		if (row === 0 || col === 0 || !onSlotDoubleClick) return;

		const dayIndex = col - 1;
		const hourIndex = row - 1;

		const targetStart = new Date(start);
		targetStart.setDate(targetStart.getDate() + dayIndex);
		targetStart.setHours(hourIndex, 0, 0, 0);

		const targetEnd = new Date(targetStart);
		targetEnd.setHours(hourIndex + 1, 0, 0, 0);

		onSlotDoubleClick(
			formatDateTimeLocal(targetStart),
			formatDateTimeLocal(targetEnd),
		);
	};

	const getColumnHeader = (colIndex: number) => {
		const targetDate = new Date(start);
		targetDate.setDate(targetDate.getDate() + colIndex);

		// Same short weekday as the month view's column headers
		const weekday = formatWeekdayShort(targetDate);
		const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1);
		const dateFormatted = formatDayMonth(targetDate);

		return { dayName, dateFormatted };
	};

	return (
		<div
			ref={scrollRef}
			className="flex-1 min-h-0 overflow-auto border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-950"
		>
			<div
				className="relative grid divide-x divide-y divide-stone-200 dark:divide-stone-800 min-w-full"
				style={{
					gridTemplateRows: `3rem repeat(24, ${hourHeightRem}rem)`,
					gridTemplateColumns: `3.5rem repeat(${days}, minmax(${days === 1 ? "100%" : "11rem"}, 1fr))`,
				}}
			>
				{/* Grid Cells */}
				{Array.from({ length: 25 }).map((_, row) =>
					Array.from({ length: days + 1 }).map((__, col) => {
						const isInteractiveCell = row > 0 && col > 0;
						const isHovered =
							hoveredCell?.row === row && hoveredCell?.col === col;
						const { dayName, dateFormatted } =
							col > 0
								? getColumnHeader(col - 1)
								: { dayName: "", dateFormatted: "" };

						// Deterministic key construction without raw loop indices
						const cellKey = `grid-r${row}-c${col}`;

						if (isInteractiveCell) {
							return (
								<button
									key={cellKey}
									type="button"
									onDoubleClick={() => handleCellDoubleClick(row, col)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											handleCellDoubleClick(row, col);
										}
									}}
									onMouseEnter={() => setHoveredCell({ row, col })}
									onMouseLeave={() => setHoveredCell(null)}
									className={`transition-colors flex flex-col justify-between items-center p-1 text-xs select-none cursor-pointer ${
										isHovered
											? "bg-purple-100/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800"
											: "bg-stone-50 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-900"
									}`}
									style={{
										gridRow: row + 1,
										gridColumn: col + 1,
									}}
								>
									{isHovered && (
										<span className="w-full text-center text-xs tabular-nums text-purple-800 dark:text-purple-300 bg-purple-200/60 dark:bg-purple-900/60 rounded px-1 py-0.5 mt-auto">
											{hours[row - 1]} {t("kaksoisklikkaa", "(Kaksoisklikkaa)")}
										</span>
									)}
								</button>
							);
						}

						return (
							<div
								key={cellKey}
								className={`transition-colors flex flex-col justify-between items-center p-1 text-xs select-none ${
									row === 0
										? "sticky top-0 z-30 bg-stone-100 dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 font-semibold cursor-default justify-center"
										: ""
								} ${
									col === 0
										? "sticky left-0 z-25 bg-stone-100 dark:bg-stone-900 border-r border-stone-300 dark:border-stone-700 tabular-nums text-stone-600 dark:text-stone-400 cursor-default justify-center text-xs"
										: ""
								} ${row === 0 && col === 0 ? "z-40" : ""}`}
								style={{
									gridRow: row + 1,
									gridColumn: col + 1,
								}}
							>
								{row === 0 && col > 0 && (
									<div className="flex flex-col items-center">
										<span
											className={`font-semibold text-xs truncate ${col - 1 === todayColumn ? "text-purple-700 dark:text-purple-400" : ""}`}
										>
											{dayName}
										</span>
										<span className="text-xs font-normal tabular-nums text-stone-600 dark:text-stone-400">
											{dateFormatted}
										</span>
									</div>
								)}

								{col === 0 && row > 0 && <span>{hours[row - 1]}</span>}
							</div>
						);
					}),
				)}

				{/* Day Overlay Columns */}
				{Array.from({ length: days }).map((_, i) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: Grid columns are static and non-reorderable
						key={`day-${i}`}
						className="pointer-events-none relative"
						style={{ gridColumn: i + 2, gridRow: "2 / span 24" }}
					>
						<DayColumn
							events={eventsByDay[i]}
							columnIndex={i + 2}
							hourHeightRem={hourHeightRem}
						/>
						{i === todayColumn && <NowLine now={now} />}
					</div>
				))}
			</div>
		</div>
	);
}
