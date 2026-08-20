export interface CalendarEvent {
    id: string
    reservationId: string
    title: string
    start: Date
    end: Date
    resourceId: string
    resourceName?: string
}

export interface PlacedEvent extends CalendarEvent {
    col: number
    span: number
}

/**
 * Returns the Monday of the current week at 00:00:00
 */
export function startOfCurrentWeek(): Date {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
}

export function getMinutesSinceMidnight(date: Date): number {
    return date.getHours() * 60 + date.getMinutes()
}

export function getMinutesBetween(start: Date, end: Date): number {
    const diffMs = end.getTime() - start.getTime()
    return Math.max(15, Math.round(diffMs / (1000 * 60)))
}

/**
 * Calculates overlap column placement for events within a day column
 */
export function layoutDay(events: CalendarEvent[]): {
    maxCols: number
    placed: PlacedEvent[]
} {
    if (!events.length) return { maxCols: 1, placed: [] }

    const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime())
    const columns: CalendarEvent[][] = []
    const placed: PlacedEvent[] = []

    for (const event of sorted) {
        let placedInCol = false
        for (let i = 0; i < columns.length; i++) {
            const lastInCol = columns[i][columns[i].length - 1]
            if (lastInCol.end.getTime() <= event.start.getTime()) {
                columns[i].push(event)
                placed.push({ ...event, col: i + 1, span: 1 })
                placedInCol = true
                break
            }
        }
        if (!placedInCol) {
            columns.push([event])
            placed.push({ ...event, col: columns.length, span: 1 })
        }
    }

    return { maxCols: Math.max(1, columns.length), placed }
}
