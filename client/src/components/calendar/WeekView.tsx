import { useEffect, useRef, useMemo } from 'react'
import type { CalendarEvent } from '#/utils/calendarUtils'
import { DayColumn } from './DayColumn'

const weekdays = ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai', 'Sunnuntai']
const hours = Array.from({ length: 24 }).map((_, i) => `${i.toString().padStart(2, '0')}:00`)

interface WeekViewProps {
    start: Date
    days: number
    events: CalendarEvent[]
}

export function WeekView({ start, days, events }: WeekViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Scroll to ~08:00 on mount
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 480
        }
    }, [])

    // Partition events into day buckets
    const eventsByDay = useMemo(() => {
        const slots: CalendarEvent[][] = Array.from({ length: days }, () => [])
        const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()

        events.forEach((evt) => {
            const evtDateOnly = new Date(evt.start.getFullYear(), evt.start.getMonth(), evt.start.getDate()).getTime()
            const dayOffset = Math.round((evtDateOnly - startDateOnly) / (1000 * 60 * 60 * 24))

            if (dayOffset >= 0 && dayOffset < days) {
                slots[dayOffset].push(evt)
            }
        })

        return slots
    }, [events, start, days])

    return (
        <div
            ref={scrollRef}
            className="h-150 overflow-y-auto border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-950"
        >
            <div
                className="grid grid-rows-[3rem_repeat(24,5rem)] divide-x divide-y divide-stone-200 dark:divide-stone-800 w-full min-w-150"
                style={{
                    gridTemplateColumns: `4rem repeat(${days}, minmax(8rem, 1fr))`,
                }}
            >
                {/* Render grid slots & headers */}
                {Array.from({ length: 25 }).map((_, row) =>
                    Array.from({ length: days + 1 }).map((__, col) => {
                        const startDayIndex = (start.getDay() + 6) % 7
                        const dayName = weekdays[(startDayIndex + col - 1) % 7]

                        return (
                            <div
                                key={`cell-${row}-${col}`}
                                className={`bg-stone-50 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors flex justify-center items-center p-1 text-xs select-none ${row === 0 ? 'sticky top-0 z-20 bg-stone-100 dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 font-semibold' : ''
                                    } ${col === 0 ? 'sticky left-0 z-10 bg-stone-100 dark:bg-stone-900 border-r border-stone-300 dark:border-stone-700 font-mono text-stone-500' : ''
                                    } ${row === 0 && col === 0 ? 'z-30' : ''}`}
                                style={{
                                    gridRow: row + 1,
                                    gridColumn: col + 1,
                                }}
                            >
                                {row === 0 && col > 0 && <span>{dayName}</span>}
                                {col === 0 && row > 0 && <span>{hours[row - 1]}</span>}
                            </div>
                        )
                    })
                )}

                {/* Day overlay columns containing reservations */}
                {Array.from({ length: days }).map((_, i) => (
                    <DayColumn key={`day-${i}`} events={eventsByDay[i]} columnIndex={i + 2} />
                ))}
            </div>
        </div>
    )
}
