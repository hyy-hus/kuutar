// src/components/calendar/WeekView.tsx

import i18next from "i18next";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { DayColumn } from "./DayColumn";

const weekdays = [
	"Maanantai",
	"Tiistai",
	"Keskiviikko",
	"Torstai",
	"Perjantai",
	"Lauantai",
	"Sunnuntai",
];
const hours = Array.from({ length: 24 }).map((_, i) =>
	i18next.t("val00", "{{val}}:00", { val: i.toString().padStart(2, "0") }),
);

interface WeekViewProps {
	start: Date;
	days: number;
	events: CalendarEvent[];
	onSlotDoubleClick?: (startTimeISO: string, endTimeISO: string) => void;
}

function CurrentTimeIndicator({ start, days }: { start: Date; days: number }) {
	const { t } = useTranslation();
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
	const topOffset = t("calc3remValrem", "calc(3rem + {{val}}rem)", {
		val: (minutesSinceMidnight / 60) * 5,
	});

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

const formatDateTimeLocal = (date: Date) => {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export function WeekView({
	start,
	days,
	events,
	onSlotDoubleClick,
}: WeekViewProps) {
	const { t } = useTranslation();
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

	const eventsByDay = useMemo(() => {
		const slots: CalendarEvent[][] = Array.from({ length: days }, () => []);
		const startDateOnly = new Date(
			start.getFullYear(),
			start.getMonth(),
			start.getDate(),
		).getTime();

		events.forEach((evt) => {
			const evtDateOnly = new Date(
				evt.start.getFullYear(),
				evt.start.getMonth(),
				evt.start.getDate(),
			).getTime();
			const dayOffset = Math.round(
				(evtDateOnly - startDateOnly) / (1000 * 60 * 60 * 24),
			);

			if (dayOffset >= 0 && dayOffset < days) {
				slots[dayOffset].push(evt);
			}
		});

		return slots;
	}, [events, start, days]);

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

		const startDayIndex = (targetDate.getDay() + 6) % 7;
		const dayName = weekdays[startDayIndex];
		const dateFormatted = t("valval2", "{{val}}.{{val2}}.", {
			val: targetDate.getDate(),
			val2: targetDate.getMonth() + 1,
		});

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
						style={{ gridColumn: i + 2, gridRow: "1 / -1" }}
					>
						<DayColumn events={eventsByDay[i]} columnIndex={i + 2} />
					</div>
				))}
			</div>
		</div>
	);
}
