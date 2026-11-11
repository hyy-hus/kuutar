// src/components/calendar/AgendaView.tsx

import { Link } from "@tanstack/react-router";
import { CalendarX2, Clock } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
	type AgendaDay,
	type CalendarEvent,
	type DaySegment,
	groupAgendaByDay,
} from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";
import { addDays, useDateFormatter } from "#/utils/date";
import { getResourceColor } from "#/utils/resourceColors";
import { EmptyState } from "../EmptyState";
import { StatusChip } from "../StatusChip";

interface AgendaViewProps {
	/** First day of the shown month */
	monthStart: Date;
	events: CalendarEvent[];
}

function isSameDay(a: Date, b: Date) {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

function AgendaItem({ segment }: { segment: DaySegment }) {
	const { t } = useTranslation();
	const { formatTime, formatDateRange } = useDateFormatter();
	const color = getResourceColor(segment.resourceColor);
	const isPending = segment.status === "pending";
	const isMultiDay = segment.continuesBefore || segment.continuesAfter;
	const timeLabel = isMultiDay
		? formatDateRange(segment.eventStart, segment.eventEnd)
		: `${formatTime(segment.eventStart)}–${formatTime(segment.eventEnd)}`;

	return (
		<Link
			to="/reservations/$id"
			params={{ id: segment.reservationId || "" }}
			style={color?.style}
			className={cn(
				"focus-ring flex flex-col gap-0.5 rounded-md border px-3 py-2 text-sm text-stone-900 dark:text-stone-100",
				isPending
					? "border-dashed border-purple-400 bg-purple-50/70 dark:border-purple-600 dark:bg-purple-950/40"
					: cn(
							"border-stone-300 dark:border-stone-700",
							color ? color.tint : "bg-stone-100 dark:bg-stone-900",
						),
				color && ["border-l-4", color.stripe],
			)}
		>
			<span className="tabular-nums text-xs text-stone-700 dark:text-stone-300">
				{timeLabel}
			</span>
			<span className="font-semibold">{segment.title}</span>
			<span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-700 dark:text-stone-300">
				{segment.resourceName && <span>{segment.resourceName}</span>}
				{isPending && (
					<StatusChip variant="warning" icon={Clock}>
						{t("odottaa", "Odottaa")}
					</StatusChip>
				)}
			</span>
		</Link>
	);
}

/** Phone-sized replacement for the month grid: the month's reservations as a list grouped by day */
export function AgendaView({ monthStart, events }: AgendaViewProps) {
	const { t } = useTranslation();
	const { formatWeekday, formatDateOnly } = useDateFormatter();
	const today = new Date();
	const daysInMonth = addDays(
		new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1),
		-1,
	).getDate();
	const groups: AgendaDay[] = useMemo(
		() => groupAgendaByDay(events, monthStart, daysInMonth),
		[events, monthStart, daysInMonth],
	);

	if (groups.length === 0) {
		return (
			<EmptyState
				icon={CalendarX2}
				title={t("eiVarauksiaKuussa", "Ei varauksia tässä kuussa")}
			/>
		);
	}

	return (
		<div className="flex-1 min-h-0 overflow-y-auto space-y-4">
			{groups.map(({ date, segments }) => {
				const isToday = isSameDay(date, today);
				const weekday = formatWeekday(date);
				return (
					<section key={date.getTime()} className="space-y-2">
						<h2
							className={cn(
								"text-sm font-semibold",
								isToday && "text-purple-700 dark:text-purple-400",
							)}
						>
							{weekday.charAt(0).toUpperCase() + weekday.slice(1)}{" "}
							<span className="tabular-nums">{formatDateOnly(date)}</span>
						</h2>
						<ul className="space-y-2">
							{segments.map((segment) => (
								<li key={segment.id}>
									<AgendaItem segment={segment} />
								</li>
							))}
						</ul>
					</section>
				);
			})}
		</div>
	);
}
