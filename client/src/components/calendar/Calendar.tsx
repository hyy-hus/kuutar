import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { Button } from '#/components/Button'
import { useResources } from '#/hooks/useResorces'
import { useReservations } from '#/hooks/useReservations'
import { startOfCurrentWeek, type CalendarEvent } from '#/utils/calendarUtils'
import { WeekView } from './WeekView'
import { ToggleChip } from '../Chip'

export function Calendar() {
    const [start, setStart] = useState<Date>(startOfCurrentWeek)
    const [days, setDays] = useState<number>(7)
    const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([])

    const { data: resources, isLoading: loadingResources } = useResources()
    const { data: reservations, isLoading: loadingReservations } = useReservations()

    // Pre-select all resources when loaded
    useEffect(() => {
        if (resources && selectedResourceIds.length === 0) {
            setSelectedResourceIds(resources.map((r) => r.id))
        }
    }, [resources, selectedResourceIds.length])

    const moveStart = (deltaDays: number) => {
        const next = new Date(start)
        next.setDate(next.getDate() + deltaDays)
        setStart(next)
    }

    const toggleResource = (id: string) => {
        setSelectedResourceIds((prev) =>
            prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
        )
    }

    const calendarEvents = useMemo(() => {
        if (!reservations || !resources) return []

        const resourcesMap = new Map(resources.map((r) => [r.id, r.name]))
        const events: CalendarEvent[] = []

        reservations.forEach((res) => {
            if (!res.occurrences || res.occurrences.length === 0) return

            // Group occurrences by Reservation ID + Start Time
            const timeGroups = new Map<string, typeof res.occurrences>()

            res.occurrences.forEach((occ) => {
                if (selectedResourceIds.includes(occ.resource_id)) {
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

        // Final deduplication: Ensure no two events share the same (reservationId, startMs)
        const uniqueEvents = new Map<string, CalendarEvent>()
        events.forEach((evt) => {
            const key = `${evt.reservationId}_${evt.start.getTime()}`
            if (!uniqueEvents.has(key)) {
                uniqueEvents.set(key, evt)
            }
        })

        return Array.from(uniqueEvents.values())
    }, [reservations, resources, selectedResourceIds])

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
                    value={start.toISOString().split('T')[0]}
                    onChange={(e) => e.target.valueAsDate && setStart(e.target.valueAsDate)}
                    className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md"
                />

                <Button variant="secondary" size="sm" onClick={() => moveStart(days)}>
                    <ChevronRight size={18} />
                </Button>

                <select
                    value={days}
                    onChange={(e) => setDays(Number(e.target.value))}
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
                    const isSelected = selectedResourceIds.includes(res.id)
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
