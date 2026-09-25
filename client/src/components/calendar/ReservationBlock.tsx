// src/components/calendar/ReservationBlock.tsx

import { Link } from "@tanstack/react-router";
import { AlertOctagon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "#/utils/cn";
import {
	getMinutesBetween,
	getMinutesSinceMidnight,
	type PlacedEvent,
} from "#/utils/calendarUtils";

const timeFormatter = new Intl.DateTimeFormat("fi-FI", {
	hour: "2-digit",
	minute: "2-digit",
});

export function ReservationBlock({ event }: { event: PlacedEvent }) {
	const { t } = useTranslation();
	const startMins = getMinutesSinceMidnight(event.start);
	const durationMins = getMinutesBetween(event.start, event.end);
	const timeString = `${timeFormatter.format(event.start)} – ${timeFormatter.format(event.end)}`;

	const isRestriction = Boolean(event.isRestriction);

	return (
		<div
			className={cn(
				"pointer-events-auto border relative text-xs p-1 rounded-xs overflow-hidden shadow-xs hover:z-20 transition-all z-15",
				isRestriction
					? "bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900"
					: "bg-stone-200 dark:bg-stone-800 border-stone-400 dark:border-stone-600 hover:bg-stone-300 dark:hover:bg-stone-700",
			)}
			style={{
				gridColumn: `${event.col} / span ${event.span}`,
				gridRow: `${startMins + 1} / span ${durationMins}`,
			}}
			title={`${event.resourceName ?? ""}: ${event.title} (${timeString})`}
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
					<span className="font-bold truncate">{event.title}</span>
					{event.resourceName && (
						<span className="text-[10px] text-stone-700 dark:text-stone-300 truncate font-medium">
							{event.resourceName}
						</span>
					)}
					<span className="text-[10px] italic text-stone-600 dark:text-stone-400 truncate">
						{timeString}
					</span>
				</Link>
			)}
		</div>
	);
}
