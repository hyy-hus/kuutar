import { useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '#/components/Button'
import { useResources } from '#/hooks/useResorces'
import { useReservations } from '#/hooks/useReservations'
import type { CalendarEvent } from '#/utils/calendarUtils'
import { WeekView } from './WeekView'
import { ToggleChip } from '../Chip'
import type { CalendarSearch } from '#/routes/calendar'

interface CalendarProps {
    startStr: string
    days: number
    selectedResourceIds?: string[]
    onSearchChange: (nextSearch: CalendarSearch) => void
}

const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
}

const formatYYYYMMDD = (d: Date): string => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export function Calendar({
    startStr,
    days,
    selectedResourceIds,
    onSearchChange,
}: CalendarProps) {
    const start = useMemo(() => parseLocalDate(startStr), [startStr])

    const { data: resources, isLoading: loadingResources } = useResources()

    // Active selected resources fallback to all resources if none specified in URL
    const activeResourceIds = useMemo(() => {
        if (selectedResourceIds && selectedResourceIds.length > 0) {
            return selectedResourceIds
        }
        return resources?.map((r) => r.id) || []
    }, [selectedResourceIds, resources])

    // Pre-select all resources in URL if no filter param exists yet
    useEffect(() => {
        if (resources && (!selectedResourceIds || selectedResourceIds.length === 0)) {
            onSearchChange({ resources: resources.map((r) => r.id) })
        }
    }, [resources, selectedResourceIds, onSearchChange])

    // Calculate start & end ISO strings for useReservations query params
    const { startDateISO, endDateISO } = useMemo(() => {
        const startDate = new Date(start)
        startDate.setHours(0, 0, 0, 0)

        const endDate = new Date(start)
        endDate.setDate(endDate.getDate() + days)
        endDate.setHours(23, 59, 59, 999)

        return {
            startDateISO: startDate.toISOString(),
            endDateISO: endDate.toISOString(),
        }
    }, [start, days])

    // Fetch reservations filtered by range boundary
    const { data: reservations, isLoading: loadingReservations } = useReservations({
        startDate: startDateISO,
        endDate: endDateISO,
    })

    const moveStart = (deltaDays: number) => {
        const next = new Date(start)
        next.setDate(next.getDate() + deltaDays)
        onSearchChange({ start: formatYYYYMMDD(next) })
    }

    const toggleResource = (id: string) => {
        const nextResources = activeResourceIds.includes(id)
            ? activeResourceIds.filter((item) => item !== id)
            : [...activeResourceIds, id]

        onSearchChange({ resources: nextResources })
    }

    const calendarEvents = useMemo(() => {
        if (!reservations || !resources) return []

        const resourcesMap = new Map(resources.map((r) => [r.id, r.name]))
        const events: CalendarEvent[] = []

        reservations.forEach((res) => {
            if (!res.occurrences || res.occurrences.length === 0) return

            const timeGroups = new Map<string, typeof res.occurrences>()

            res.occurrences.forEach((occ) => {
                if (activeResourceIds.includes(occ.resource_id)) {
                    const startMs = new Date(occ.start_time).getTime()
                    const endMs = new Date(occ.end_time).getTime()
                    const key = `${res.id}_${startMs}_${endMs}`

                    const group = timeGroups.get(key) || []
                    group.push(occ)
                    timeGroups.set(key, group)
                }
            })

            timeGroups.forEach((occurrencesGroup) => {
                const resourceNames = Array.from(
                    new Set(
                        occurrencesGroup
                            .map((occ) => resourcesMap.get(occ.resource_id))
                            .filter(Boolean)
                    )
                ).join(', ')

                const firstOcc = occurrencesGroup[0]

                events.push({
                    id: firstOcc.id,
                    reservationId: res.id,
                    title: res.title,
                    start: new Date(firstOcc.start_time),
                    end: new Date(firstOcc.end_time),
                    resourceId: firstOcc.resource_id,
                    resourceName: resourceNames,
                })
            })
        })

        const uniqueEvents = new Map<string, CalendarEvent>()
        events.forEach((evt) => {
            const key = `${evt.reservationId}_${evt.start.getTime()}`
            if (!uniqueEvents.has(key)) {
                uniqueEvents.set(key, evt)
            }
        })

        return Array.from(uniqueEvents.values())
    }, [reservations, resources, activeResourceIds])

    if (loadingResources || loadingReservations) {
        return (
            <div className="p-8 flex items-center justify-center gap-2 text-stone-500">
                <Loader2 className="animate-spin" size={18} />
                <span>Ladataan kalenteria...</span>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-4 p-2 flex-1 min-h-0">
            {/* Controls Bar */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={() => moveStart(-days)}>
                    <ChevronLeft size={18} />
                </Button>

                <input
                    type="date"
                    value={formatYYYYMMDD(start)}
                    onChange={(e) =>
                        e.target.valueAsDate &&
                        onSearchChange({ start: formatYYYYMMDD(e.target.valueAsDate) })
                    }
                    className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md"
                />

                <Button variant="secondary" size="sm" onClick={() => moveStart(days)}>
                    <ChevronRight size={18} />
                </Button>

                <select
                    value={days}
                    onChange={(e) => onSearchChange({ days: Number(e.target.value) })}
                    className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md"
                >
                    <option value={1}>1 päivä</option>
                    <option value={3}>3 päivää</option>
                    <option value={5}>5 päivää</option>
                    <option value={7}>1 viikko</option>
                </select>
            </div>

            {/* Resource Filter Chips */}
            <div className="flex flex-wrap gap-1.5 shrink-0">
                {resources?.map((res) => {
                    const isSelected = activeResourceIds.includes(res.id)
                    return (
                        <ToggleChip
                            key={res.id}
                            selected={isSelected}
                            onClick={() => toggleResource(res.id)}
                        >
                            {res.name}
                        </ToggleChip>
                    )
                })}
            </div>

            {/* Main Calendar View */}
            <WeekView start={start} days={days} events={calendarEvents} />
        </div>
    )
}
