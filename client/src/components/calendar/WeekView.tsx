// src/components/calendar/WeekView.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type CalendarEvent, splitEventsByDay } from "#/utils/calendarUtils";
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
	events: CalendarEvent[];
	onSlotDoubleClick?: (startTimeISO: string, endTimeISO: string) => void;
}

function CurrentTimeIndicator({ start, days }: { start: Date; days: number }) {
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		const timer = setInterval(() => setNow(new Date()), 60000);
		return () => clearInterval(timer);
	}, []);

	const todayDateOnly = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate(),
	).getTime();
	const startDateOnly = new Date(
		start.getFullYear(),
		start.getMonth(),
		start.getDate(),
	).getTime();
	const dayOffset = Math.round(
		(todayDateOnly - startDateOnly) / (1000 * 60 * 60 * 24),
	);

	const isTodayVisible = dayOffset >= 0 && dayOffset < days;

	if (!isTodayVisible) return null;

	const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
	const topOffset = `calc(3rem + ${(minutesSinceMidnight / 60) * 5}rem)`;

	return (
		<div
			className="absolute left-0 right-0 z-10 pointer-events-none border-none"
			style={{
				top: topOffset,
				gridColumn: `2 / -1`, // Starts strictly after the hour column and spans across all day columns
			}}
		>
			<div className="h-0.5 bg-rose-500/80 dark:bg-rose-400/80 w-full" />
		</div>
	);
}

export function WeekView({
	start,
	days,
	events,
	onSlotDoubleClick,
}: WeekViewProps) {
	const { t, i18n } = useTranslation();
	const { formatTime } = useDateFormatter();
	const hours = hourDates.map((d) => formatTime(d));
	const scrollRef = useRef<HTMLDivElement>(null);
	const [hoveredCell, setHoveredCell] = useState<{
		row: number;
		col: number;
	} | null>(null);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = 480; // Scroll to ~08:00
		}
	}, []);

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

		const weekday = new Intl.DateTimeFormat(i18n.language, {
			weekday: "long",
		}).format(targetDate);
		const dayName = weekday.charAt(0).toUpperCase() + weekday.slice(1);
		const dateFormatted = `${targetDate.getDate()}.${targetDate.getMonth() + 1}.`;

		return { dayName, dateFormatted };
	};

	return (
		<div
			ref={scrollRef}
			className="flex-1 min-h-0 overflow-auto border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-950"
		>
			<div
				className="relative grid grid-rows-[3rem_repeat(24,5rem)] divide-x divide-y divide-stone-200 dark:divide-stone-800 min-w-full"
				style={{
					gridTemplateColumns: `3.5rem repeat(${days}, minmax(${days === 1 ? "100%" : "11rem"}, 1fr))`,
				}}
			>
				{/* Current Time Indicator anchored to gridColumn */}
				<CurrentTimeIndicator start={start} days={days} />

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
										<span className="w-full text-center text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-200/60 dark:bg-purple-900/60 rounded px-1 py-0.5 mt-auto">
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
										? "sticky top-0 z-20 bg-stone-100 dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 font-semibold cursor-default justify-center"
										: ""
								} ${
									col === 0
										? "sticky left-0 z-20 bg-stone-100 dark:bg-stone-900 border-r border-stone-300 dark:border-stone-700 font-mono text-stone-500 cursor-default justify-center text-[11px]"
										: ""
								} ${row === 0 && col === 0 ? "z-30" : ""}`}
								style={{
									gridRow: row + 1,
									gridColumn: col + 1,
								}}
							>
								{row === 0 && col > 0 && (
									<div className="flex flex-col items-center">
										<span className="font-bold text-xs truncate">
											{dayName}
										</span>
										<span className="text-[10px] font-normal text-stone-500">
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
						className="pointer-events-none"
						style={{ gridColumn: i + 2, gridRow: "2 / span 24" }}
					>
						<DayColumn events={eventsByDay[i]} columnIndex={i + 2} />
					</div>
				))}
			</div>
		</div>
	);
}
