import { useMemo } from 'react'
import { layoutDay, type CalendarEvent } from '#/utils/calendarUtils'
import { ReservationBlock } from './ReservationBlock'

interface DayColumnProps {
    events: CalendarEvent[]
    columnIndex: number
}

export function DayColumn({ events, columnIndex }: DayColumnProps) {
    const { maxCols, placed } = useMemo(() => layoutDay(events), [events])

    return (
        <div
            className="grid grid-rows-[repeat(1440,1fr)] gap-x-0.5 w-full h-full pointer-events-auto"
            style={{
                gridTemplateColumns: `repeat(${maxCols}, minmax(0, 1fr))`,
                gridRow: '2 / span 24',
                gridColumn: columnIndex,
            }}
        >
            {placed.map((evt) => (
                <ReservationBlock key={evt.id} event={evt} />
            ))}
        </div>
    )
}
