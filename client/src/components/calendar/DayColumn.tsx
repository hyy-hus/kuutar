import { useMemo } from "react";
import { type DaySegment, layoutDay } from "#/utils/calendarUtils";
import { ReservationBlock } from "./ReservationBlock";

interface DayColumnProps {
	events: DaySegment[];
	columnIndex: number;
	/** Height of one hour row in rem */
	hourHeightRem: number;
}

export function DayColumn({
	events,
	columnIndex,
	hourHeightRem,
}: DayColumnProps) {
	const { maxCols, placed } = useMemo(() => layoutDay(events), [events]);

	return (
		<div
			className="relative w-full h-full pointer-events-none"
			style={{
				gridColumn: columnIndex,
				gridRow: "2 / -1", // Align cleanly to the start of 00:00 below the header
			}}
		>
			{placed.map((evt) => (
				<ReservationBlock
					key={evt.id}
					event={evt}
					maxCols={maxCols}
					hourHeightRem={hourHeightRem}
				/>
			))}
		</div>
	);
}
