// src/components/calendar/WeekView.tsx
import { useEffect, useRef, useMemo, useState } from 'react'
import type { CalendarEvent } from '#/utils/calendarUtils'
import { DayColumn } from './DayColumn'

const weekdays = ['Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai', 'Sunnuntai']
const hours = Array.from({ length: 24 }).map((_, i) => `${i.toString().padStart(2, '0')}:00`)

interface WeekViewProps {
    start: Date
    days: number
    events: CalendarEvent[]
    onSlotDoubleClick?: (startTimeISO: string, endTimeISO: string) => void
}

function CurrentTimeIndicator({ start, days }: { start: Date; days: number }) {
    const [now, setNow] = useState(() => new Date())

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000)
        return () => clearInterval(timer)
    }, [])

    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
    const startDateOnly = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime()
    const dayOffset = Math.round((today - startDateOnly) / (1000 * 60 * 60 * 24))

    const isTodayVisible = dayOffset >= 0 && dayOffset < days

    if (!isTodayVisible) return null

    const minutesSinceMidnight = now.getHours() * 60 + now.getMinutes()
    const topOffset = `calc(3rem + ${(minutesSinceMidnight / 60) * 5}rem)`

    return (
        <div
            className="absolute left-0 right-0 z-30 pointer-events-none flex items-center border-none"
            style={{ top: topOffset }}
        >
            <div className="w-2.5 h-2.5 rounded-full bg-rose-600 -ml-1 shrink-0" />
            <div className="h-0.5 bg-rose-600 dark:bg-rose-500 w-full shadow-xs" />
        </div>
    )
}

const formatDateTimeLocal = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function WeekView({ start, days, events, onSlotDoubleClick }: WeekViewProps) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null)

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = 480
        }
    }, [])

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

    const handleCellDoubleClick = (row: number, col: number) => {
        if (row === 0 || col === 0 || !onSlotDoubleClick) return

        const dayIndex = col - 1
        const hourIndex = row - 1

        const targetStart = new Date(start)
        targetStart.setDate(targetStart.getDate() + dayIndex)
        targetStart.setHours(hourIndex, 0, 0, 0)

        const targetEnd = new Date(targetStart)
        targetEnd.setHours(hourIndex + 1, 0, 0, 0)

        onSlotDoubleClick(formatDateTimeLocal(targetStart), formatDateTimeLocal(targetEnd))
    }

    return (
        <div
            ref={scrollRef}
            className="flex-1 min-h-0 overflow-y-auto border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-950"
        >
            <div
                className="relative grid grid-rows-[3rem_repeat(24,5rem)] divide-x divide-y divide-stone-200 dark:divide-stone-800 w-full min-w-150"
                style={{
                    gridTemplateColumns: `4rem repeat(${days}, minmax(8rem, 1fr))`,
                }}
            >
                <CurrentTimeIndicator start={start} days={days} />

                {Array.from({ length: 25 }).map((_, row) =>
                    Array.from({ length: days + 1 }).map((__, col) => {
                        const startDayIndex = (start.getDay() + 6) % 7
                        const dayName = weekdays[(startDayIndex + col - 1) % 7]
                        const isInteractiveCell = row > 0 && col > 0
                        const isHovered = hoveredCell?.row === row && hoveredCell?.col === col

                        return (
                            <div
                                key={`cell-${row}-${col}`}
                                onDoubleClick={() => handleCellDoubleClick(row, col)}
                                onMouseEnter={() => isInteractiveCell && setHoveredCell({ row, col })}
                                onMouseLeave={() => isInteractiveCell && setHoveredCell(null)}
                                className={`transition-colors flex flex-col justify-between items-center p-1 text-xs select-none ${row === 0
                                    ? 'sticky top-0 z-20 bg-stone-100 dark:bg-stone-900 border-b border-stone-300 dark:border-stone-700 font-semibold cursor-default justify-center'
                                    : ''
                                    } ${col === 0
                                        ? 'sticky left-0 z-10 bg-stone-100 dark:bg-stone-900 border-r border-stone-300 dark:border-stone-700 font-mono text-stone-500 cursor-default justify-center'
                                        : ''
                                    } ${row === 0 && col === 0 ? 'z-30' : ''} ${isInteractiveCell
                                        ? isHovered
                                            ? 'bg-purple-100/70 dark:bg-purple-950/40 border-purple-300 dark:border-purple-800 cursor-pointer'
                                            : 'bg-stone-50 dark:bg-stone-900/40 hover:bg-stone-100 dark:hover:bg-stone-900 cursor-pointer'
                                        : ''
                                    }`}
                                style={{
                                    gridRow: row + 1,
                                    gridColumn: col + 1,
                                }}
                            >
                                {row === 0 && col > 0 && <span>{dayName}</span>}
                                {col === 0 && row > 0 && <span>{hours[row - 1]}</span>}

                                {isInteractiveCell && isHovered && (
                                    <span className="w-full text-center text-[10px] font-mono text-purple-700 dark:text-purple-300 bg-purple-200/60 dark:bg-purple-900/60 rounded px-1 py-0.5 mt-auto">
                                        {hours[row - 1]} – {hours[row] || '00:00'}
                                    </span>
                                )}
                            </div>
                        )
                    })
                )}

                {/* Day Overlay Columns - set pointer-events-none on wrapper so double clicks pass through to grid cells */}
                {Array.from({ length: days }).map((_, i) => (
                    <div key={`day-${i}`} className="pointer-events-none col-span-1" style={{ gridColumn: i + 2, gridRow: '1 / -1' }}>
                        <DayColumn events={eventsByDay[i]} columnIndex={i + 2} />
                    </div>
                ))}
            </div>
        </div>
    )
}
