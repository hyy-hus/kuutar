import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, Loader2, Plus, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '#/components/Button'
import { Chip } from '#/components/Chip'
import { useResources } from '#/hooks/useResorces'
import { useReservations, type ReservationWithOccurrences } from '#/hooks/useReservations'
import { startOfCurrentWeek } from '#/utils/calendarUtils'
import { cn } from '#/utils/cn'
import { readable_uuid } from '#/utils/uuid'
import { formatDate } from '#/utils/date'

export interface ReservationsSearch {
    start_date?: string
    days?: number
    resource_id?: string
}

const formatYYYYMMDD = (d: Date) => {
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

const parseLocalDate = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day, 0, 0, 0, 0)
}

export const Route = createFileRoute('/_app/reservations/')({
    validateSearch: (search: Record<string, unknown>): ReservationsSearch => {
        return {
            start_date: typeof search.start_date === 'string' ? search.start_date : undefined,
            days: typeof search.days === 'number' ? search.days : undefined,
            resource_id: typeof search.resource_id === 'string' ? search.resource_id : undefined,
        }
    },
    component: RouteComponent,
})

function ReservationCard({ reservation }: { reservation: ReservationWithOccurrences }) {
    const firstOccurrence = reservation.occurrences?.[0]

    return (
        <li className={cn('p-2 border-2 dark:border-stone-600 flex flex-col gap-1 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors')}>
            <div className="flex items-center">
                <h3 className="font-bold truncate">{reservation.title}</h3>
                <span className="flex-1" />
                <Chip>{readable_uuid(reservation.id)}</Chip>
            </div>

            {firstOccurrence ? (
                <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                    <Calendar size={14} />
                    <span>{formatDate(firstOccurrence.start_time)}</span>
                </div>
            ) : (
                <span className="text-xs text-stone-400">Ei tiettyjä aikoja</span>
            )}

            <div className="pt-2">
                <Button variant="secondary" size="sm" asChild>
                    <Link to="/reservations/$id" params={{ id: reservation.id }} className="hover:underline font-medium">
                        <span>Näytä</span>
                        <Eye size={18} />
                    </Link>
                </Button>
            </div>
        </li>
    )
}

function ReservationList() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()

    const { data: resources, isLoading: loadingResources } = useResources()

    // Default start date to start of current week if missing
    const defaultStartStr = formatYYYYMMDD(startOfCurrentWeek())
    const startStr = search.start_date || defaultStartStr
    const days = search.days || 7
    const resourceId = search.resource_id

    const start = useMemo(() => parseLocalDate(startStr), [startStr])

    // Compute ISO window for API request
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

    const { data: reservations, isLoading, isError } = useReservations({
        startDate: startDateISO,
        endDate: endDateISO,
        resourceId,
    })

    const updateSearch = (next: ReservationsSearch) => {
        navigate({
            search: (prev) => ({ ...prev, ...next }),
            replace: true,
        })
    }

    const moveStart = (deltaDays: number) => {
        const next = new Date(start)
        next.setDate(next.getDate() + deltaDays)
        updateSearch({ start_date: formatYYYYMMDD(next) })
    }

    return (
        <div className={cn('flex flex-col gap-4 p-4 flex-1 min-h-0')}>
            {/* Header Action Bar */}
            <div className="flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                    Varaukset
                </h1>
                <Button asChild>
                    <Link to="/reservations/create">
                        <span>Lisää varaus</span>
                        <Plus size={18} />
                    </Link>
                </Button>
            </div>

            {/* Time-Range and Filter Selector */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 p-2 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
                <Button variant="secondary" size="sm" onClick={() => moveStart(-days)}>
                    <ChevronLeft size={18} />
                </Button>

                <input
                    type="date"
                    value={formatYYYYMMDD(start)}
                    onChange={(e) =>
                        e.target.valueAsDate &&
                        updateSearch({ start_date: formatYYYYMMDD(e.target.valueAsDate) })
                    }
                    className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md"
                />

                <Button variant="secondary" size="sm" onClick={() => moveStart(days)}>
                    <ChevronRight size={18} />
                </Button>

                <select
                    value={days}
                    onChange={(e) => updateSearch({ days: Number(e.target.value) })}
                    className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md"
                >
                    <option value={7}>1 viikko</option>
                    <option value={14}>2 viikkoa</option>
                    <option value={30}>1 kuukausi</option>
                    <option value={90}>3 kuukautta</option>
                </select>

                {/* Resource Filter */}
                <select
                    value={resourceId || ''}
                    onChange={(e) =>
                        updateSearch({ resource_id: e.target.value || undefined })
                    }
                    disabled={loadingResources}
                    className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md"
                >
                    <option value="">Kaikki resurssit</option>
                    {resources?.map((res) => (
                        <option key={res.id} value={res.id}>
                            {res.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Content List */}
            {isLoading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-stone-500">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Ladataan varauksia...</span>
                </div>
            ) : isError ? (
                <div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
                    Virhe ladattaessa varauksia. Tarkista valittu aikaväli.
                </div>
            ) : reservations && reservations.length > 0 ? (
                <ul className={cn('grid grid-cols-1 sm:grid-cols-2 gap-2')}>
                    {reservations.map((res) => (
                        <ReservationCard key={res.id} reservation={res} />
                    ))}
                </ul>
            ) : (
                <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/50 rounded-md border border-stone-200 dark:border-stone-800">
                    Ei varauksia valitulla aikavälillä.
                </div>
            )}
        </div>
    )
}

function RouteComponent() {
    return <ReservationList />
}
