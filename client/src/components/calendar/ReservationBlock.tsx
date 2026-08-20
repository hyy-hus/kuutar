import { Link } from '@tanstack/react-router'
import {
    getMinutesSinceMidnight,
    getMinutesBetween,
    type PlacedEvent,
} from '#/utils/calendarUtils'

const timeFormatter = new Intl.DateTimeFormat('fi-FI', {
    hour: '2-digit',
    minute: '2-digit',
})

export function ReservationBlock({ event }: { event: PlacedEvent }) {
    const startMins = getMinutesSinceMidnight(event.start)
    const durationMins = getMinutesBetween(event.start, event.end)
    const timeString = `${timeFormatter.format(event.start)} – ${timeFormatter.format(event.end)}`

    return (
        <div
            className="bg-stone-200 dark:bg-stone-800 border border-stone-400 dark:border-stone-600 hover:bg-stone-300 dark:hover:bg-stone-700 relative z-10 text-xs p-1 rounded-xs overflow-hidden shadow-xs hover:z-20 transition-all"
            style={{
                gridColumn: `${event.col} / span ${event.span}`,
                gridRow: `${startMins + 1} / span ${durationMins}`,
            }}
            title={`${event.resourceName ?? ''}: ${event.title} (${timeString})`}
        >
            <Link
                to="/reservations/$id"
                params={{ id: event.reservationId }}
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
        </div>
    )
}
