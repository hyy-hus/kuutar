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
 * Calculates overlap column placement for events within a day column.
 * Cluster-based greedy allocation that stretches non-conflicting events across available spans.
 */
export function layoutDay(events: CalendarEvent[]): {
    maxCols: number
    placed: PlacedEvent[]
} {
    if (!events.length) return { maxCols: 1, placed: [] }

    // 1. Sort events by start time, then duration (descending)
    const sorted = [...events].sort((a, b) => {
        if (a.start.getTime() !== b.start.getTime()) {
            return a.start.getTime() - b.start.getTime()
        }
        return b.end.getTime() - a.end.getTime()
    })

    // 2. Partition into contiguous overlapping clusters
    const clusters: CalendarEvent[][] = []
    let currentCluster: CalendarEvent[] = []
    let clusterEnd = 0

    sorted.forEach((evt) => {
        const startMs = evt.start.getTime()
        const endMs = evt.end.getTime()

        if (currentCluster.length === 0 || startMs < clusterEnd) {
            currentCluster.push(evt)
            clusterEnd = Math.max(clusterEnd, endMs)
        } else {
            clusters.push(currentCluster)
            currentCluster = [evt]
            clusterEnd = endMs
        }
    })
    if (currentCluster.length > 0) {
        clusters.push(currentCluster)
    }

    // 3. Lay out each cluster and calculate dynamic column span
    const placed: PlacedEvent[] = []
    let globalMaxCols = 1

    clusters.forEach((cluster) => {
        const columns: CalendarEvent[][] = []

        cluster.forEach((evt) => {
            let placedInCol = false
            for (let i = 0; i < columns.length; i++) {
                const lastInCol = columns[i][columns[i].length - 1]
                if (lastInCol.end.getTime() <= evt.start.getTime()) {
                    columns[i].push(evt)
                    placedInCol = true
                    break
                }
            }
            if (!placedInCol) {
                columns.push([evt])
            }
        })

        const clusterCols = columns.length
        globalMaxCols = Math.max(globalMaxCols, clusterCols)

        // Assign column indices and compute dynamic span expansion
        cluster.forEach((evt) => {
            let colIdx = 0
            for (let i = 0; i < columns.length; i++) {
                if (columns[i].includes(evt)) {
                    colIdx = i
                    break
                }
            }

            // Expand span if there are no colliding neighbors to the right
            let span = 1
            for (let j = colIdx + 1; j < clusterCols; j++) {
                const hasCollision = columns[j].some(
                    (other) =>
                        evt.start.getTime() < other.end.getTime() &&
                        evt.end.getTime() > other.start.getTime()
                )
                if (!hasCollision) {
                    span++
                } else {
                    break
                }
            }

            placed.push({
                ...evt,
                col: colIdx + 1,
                span,
            })
        })
    })

    return { maxCols: globalMaxCols, placed }
}
