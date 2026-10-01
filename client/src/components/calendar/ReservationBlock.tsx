import { Link } from "@tanstack/react-router";
import { AlertOctagon, Clock, User as UserIcon } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
	getMinutesBetween,
	getMinutesSinceMidnight,
	type PlacedEvent,
} from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";

const timeFormatter = new Intl.DateTimeFormat("fi-FI", {
	hour: "2-digit",
	minute: "2-digit",
});

interface ReservationBlockProps {
	event: PlacedEvent;
	maxCols: number;
}

export function ReservationBlock({ event, maxCols }: ReservationBlockProps) {
	const { t } = useTranslation();
	const startMins = getMinutesSinceMidnight(event.start);
	const durationMins = getMinutesBetween(event.start, event.end);
	const timeString = `${timeFormatter.format(event.start)} – ${timeFormatter.format(event.end)}`;

	// Exact percentage math over 1440 minutes in a 24h day
	const topPct = (startMins / 1440) * 100;
	const heightPct = (durationMins / 1440) * 100;

	// Column width calculation for overlapping events
	const colWidthPct = 100 / maxCols;
	const leftPct = (event.col - 1) * colWidthPct;
	const widthPct = event.span * colWidthPct;

	const isRestriction = Boolean(event.isRestriction);
	const isPending = event.status === "pending";

	const tooltipText = isRestriction
		? `${event.resourceName ?? ""}: ${event.title} (${timeString})`
		: `${event.resourceName ?? ""}: ${event.title}${isPending ? ` [${t("odottaa", "Odottaa")}]` : ""}${event.userName ? ` [${event.userName}]` : ""} (${timeString})`;

	useEffect(() => {
		console.log(event);
	}, [event]);

	return (
		<div
			className={cn(
				"absolute pointer-events-auto border text-xs p-1 rounded-xs overflow-hidden shadow-xs hover:z-20 transition-all z-15 box-border",
				isRestriction
					? "bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900"
					: isPending
						? "bg-purple-50/70 dark:bg-purple-950/40 border-dashed border-purple-400 dark:border-purple-600 opacity-80 hover:opacity-100 hover:bg-purple-100 dark:hover:bg-purple-900/60"
						: "bg-stone-200 dark:bg-stone-800 border-stone-400 dark:border-stone-600 hover:bg-stone-300 dark:hover:bg-stone-700",
			)}
			style={{
				top: `${topPct}%`,
				height: `${heightPct}%`,
				left: `${leftPct}%`,
				width: `${widthPct}%`,
			}}
			title={tooltipText}
		>
			{isRestriction ? (
				<Link
					to="/restrictions/$id"
					params={{ id: event.restrictionId || "" }}
					className="flex flex-col h-full w-full overflow-hidden text-amber-900 dark:text-amber-200 hover:underline"
				>
					<div className="flex items-center gap-1 font-bold truncate">
						<AlertOctagon size={12} className="text-amber-600 shrink-0" />
						<span className="truncate">{event.title}</span>
					</div>
					{event.resourceName && (
						<span className="text-[10px] text-amber-800 dark:text-amber-300 truncate font-medium">
							{event.resourceName}
						</span>
					)}
					<span className="text-[10px] italic text-amber-700 dark:text-amber-400 truncate">
						{timeString}
					</span>
				</Link>
			) : (
				<Link
					to="/reservations/$id"
					params={{ id: event.reservationId || "" }}
					className="flex flex-col h-full w-full overflow-hidden text-stone-900 dark:text-stone-100 hover:underline"
				>
					<div className="flex items-center gap-1 font-bold truncate">
						{isPending && (
							<Clock
								size={11}
								className="text-purple-600 dark:text-purple-400 shrink-0"
							/>
						)}
						<span className="truncate">{event.title}</span>
					</div>

					{isPending && (
						<span className="text-[9px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider truncate">
							{t("odottaaVahvistusta", "Odottaa vahvistusta")}
						</span>
					)}

					{event.userName && (
						<span className="text-[10px] text-stone-700 dark:text-stone-300 truncate flex items-center gap-0.5">
							<UserIcon
								size={10}
								className="shrink-0 text-purple-600 dark:text-purple-400"
							/>
							<span className="truncate">{event.userName}</span>
						</span>
					)}
					{event.resourceName && (
						<span className="text-[10px] text-stone-600 dark:text-stone-400 truncate font-medium">
							{event.resourceName}
						</span>
					)}
					<span className="text-[10px] italic text-stone-500 dark:text-stone-400 truncate">
						{timeString}
					</span>
				</Link>
			)}
		</div>
	);
}
