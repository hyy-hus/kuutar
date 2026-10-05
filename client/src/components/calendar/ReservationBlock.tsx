import { Link } from "@tanstack/react-router";
import {
	AlertOctagon,
	CalendarCheck,
	Clock,
	User as UserIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { getSegmentGridMinutes, type PlacedEvent } from "#/utils/calendarUtils";
import { cn } from "#/utils/cn";
import { formatDateTimeLocal, useDateFormatter } from "#/utils/date";
import { getResourceColor } from "#/utils/resourceColors";

/** Approximate rem heights of the block's parts, for deciding which lines fit */
const TITLE_LINE_REM = 1;
const DETAIL_LINE_REM = 0.85;
/** Vertical padding (p-1) and borders around the content */
const BLOCK_CHROME_REM = 0.625;

interface ReservationBlockProps {
	event: PlacedEvent;
	maxCols: number;
	/** Height of one hour row in rem */
	hourHeightRem: number;
}

export function ReservationBlock({
	event,
	maxCols,
	hourHeightRem,
}: ReservationBlockProps) {
	const { t } = useTranslation();
	const { formatTime, formatDateRange } = useDateFormatter();
	const { startMins, endMins } = getSegmentGridMinutes(event);
	const isMultiDay = event.continuesBefore || event.continuesAfter;
	// Label the whole event, not just this day's segment, adding dates when it spans days
	const timeString = isMultiDay
		? formatDateRange(event.eventStart, event.eventEnd)
		: `${formatTime(event.eventStart)} – ${formatTime(event.eventEnd)}`;

	// Percentage math over the grid's 1440 clock minutes
	const topPct = (startMins / 1440) * 100;
	const heightPct = ((endMins - startMins) / 1440) * 100;

	// Show only as many detail lines as the block has room for; short blocks get just the title
	const heightRem = ((endMins - startMins) / 60) * hourHeightRem;
	const detailLineCount = Math.max(
		0,
		Math.floor(
			(heightRem - BLOCK_CHROME_REM - TITLE_LINE_REM) / DETAIL_LINE_REM,
		),
	);
	const isTitleOnly = detailLineCount === 0;

	// Column width calculation for overlapping events
	const colWidthPct = 100 / maxCols;
	const leftPct = (event.col - 1) * colWidthPct;
	const widthPct = event.span * colWidthPct;

	const isRestriction = Boolean(event.isRestriction);
	const isBlock = Boolean(event.isBlock);
	const isPending = event.status === "pending";
	// Blocks and restrictions keep their own look
	const color =
		isBlock || isRestriction
			? undefined
			: getResourceColor(event.resourceColor);

	const tooltipText = isBlock
		? `${t("vapaaVarausjakso", "Vapaa varausjakso")}: ${event.resourceName ?? ""}: ${event.title} (${timeString})`
		: isRestriction
			? `${event.resourceName ?? ""}: ${event.title} (${timeString})`
			: `${event.resourceName ?? ""}: ${event.title}${isPending ? ` [${t("odottaa", "Odottaa")}]` : ""}${event.userName ? ` [${event.userName}]` : ""} (${timeString})`;

	// Detail lines in order of importance, cut down to what fits
	const details: { key: string; node: ReactNode }[] = [];
	if (isBlock) {
		if (event.resourceName) {
			details.push({
				key: "resource",
				node: (
					<span className="text-[10px] text-emerald-800 dark:text-emerald-300 truncate font-medium">
						{event.resourceName}
					</span>
				),
			});
		}
		details.push({
			key: "time",
			node: (
				<span className="text-[10px] italic text-emerald-700 dark:text-emerald-400 truncate">
					{timeString}
				</span>
			),
		});
	} else if (isRestriction) {
		if (event.resourceName) {
			details.push({
				key: "resource",
				node: (
					<span className="text-[10px] text-amber-800 dark:text-amber-300 truncate font-medium">
						{event.resourceName}
					</span>
				),
			});
		}
		details.push({
			key: "time",
			node: (
				<span className="text-[10px] italic text-amber-700 dark:text-amber-400 truncate">
					{timeString}
				</span>
			),
		});
	} else {
		if (isPending) {
			details.push({
				key: "pending",
				node: (
					<span className="text-[9px] font-semibold text-purple-700 dark:text-purple-300 uppercase tracking-wider truncate">
						{t("odottaaVahvistusta", "Odottaa vahvistusta")}
					</span>
				),
			});
		}
		if (event.userName) {
			details.push({
				key: "user",
				node: (
					<span className="text-[10px] text-stone-700 dark:text-stone-300 truncate flex items-center gap-0.5">
						<UserIcon
							size={10}
							className="shrink-0 text-purple-600 dark:text-purple-400"
						/>
						<span className="truncate">{event.userName}</span>
					</span>
				),
			});
		}
		if (event.resourceName) {
			details.push({
				key: "resource",
				node: (
					<span className="text-[10px] text-stone-600 dark:text-stone-400 truncate font-medium">
						{event.resourceName}
					</span>
				),
			});
		}
		details.push({
			key: "time",
			node: (
				<span className="text-[10px] italic text-stone-500 dark:text-stone-400 truncate">
					{timeString}
				</span>
			),
		});
	}

	const content = (
		<>
			<div className="flex items-center gap-1 font-bold truncate shrink-0">
				{isBlock ? (
					<CalendarCheck size={12} className="text-emerald-600 shrink-0" />
				) : isRestriction ? (
					<AlertOctagon size={12} className="text-amber-600 shrink-0" />
				) : (
					isPending && (
						<Clock
							size={11}
							className="text-purple-600 dark:text-purple-400 shrink-0"
						/>
					)
				)}
				<span className="truncate">{event.title}</span>
			</div>
			{details.slice(0, detailLineCount).map(({ key, node }) => (
				<div key={key} className="flex min-w-0 shrink-0">
					{node}
				</div>
			))}
		</>
	);

	return (
		<div
			className={cn(
				"absolute pointer-events-auto border text-xs px-1 rounded-xs overflow-hidden shadow-xs hover:z-20 transition-all z-15 box-border",
				// Title-only blocks may be barely taller than one line, so trim the padding
				isTitleOnly ? "py-0" : "py-1",
				// Open edges show that the event carries on from / into the neighbouring day
				event.continuesBefore && "rounded-t-none border-t-0",
				event.continuesAfter && "rounded-b-none border-b-0",
				isBlock
					? "bg-emerald-50 dark:bg-emerald-950/50 border-dashed border-emerald-500 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/70"
					: isRestriction
						? "bg-amber-100 dark:bg-amber-950/80 border-amber-400 dark:border-amber-700 hover:bg-amber-200 dark:hover:bg-amber-900"
						: isPending
							? "bg-purple-50/70 dark:bg-purple-950/40 border-dashed border-purple-400 dark:border-purple-600 opacity-80 hover:opacity-100 hover:bg-purple-100 dark:hover:bg-purple-900/60"
							: cn(
									"border-stone-400 dark:border-stone-600",
									color
										? color.tint
										: "bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700",
								),
				// A stripe in the resource's color marks which resource the event is on
				color && ["border-l-4", color.stripe],
			)}
			style={{
				top: `${topPct}%`,
				height: `${heightPct}%`,
				left: `${leftPct}%`,
				width: `${widthPct}%`,
			}}
			title={tooltipText}
		>
			{isBlock ? (
				<Link
					to="/reservations/create"
					search={{
						start_time: formatDateTimeLocal(event.eventStart),
						end_time: formatDateTimeLocal(event.eventEnd),
						resource_ids: [event.resourceId],
					}}
					className="flex flex-col h-full w-full overflow-hidden text-emerald-900 dark:text-emerald-200 hover:underline"
				>
					{content}
				</Link>
			) : isRestriction ? (
				<Link
					to="/restrictions/$id"
					params={{ id: event.restrictionId || "" }}
					className="flex flex-col h-full w-full overflow-hidden text-amber-900 dark:text-amber-200 hover:underline"
				>
					{content}
				</Link>
			) : (
				<Link
					to="/reservations/$id"
					params={{ id: event.reservationId || "" }}
					className="flex flex-col h-full w-full overflow-hidden text-stone-900 dark:text-stone-100 hover:underline"
				>
					{content}
				</Link>
			)}
		</div>
	);
}
