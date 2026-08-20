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

    // Flatten occurrences into calendar event objects
    const calendarEvents = useMemo(() => {
        if (!reservations || !resources) return []

        const resourcesMap = new Map(resources.map((r) => [r.id, r.name]))
        const events: CalendarEvent[] = []

        reservations.forEach((res) => {
            res.occurrences?.forEach((occ) => {
                if (selectedResourceIds.includes(occ.resource_id)) {
                    events.push({
                        id: occ.id,
                        reservationId: res.id,
                        title: res.title,
                        start: new Date(occ.start_time),
                        end: new Date(occ.end_time),
                        resourceId: occ.resource_id,
                        resourceName: resourcesMap.get(occ.resource_id),
                    })
                }
            })
        })

        return events
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
