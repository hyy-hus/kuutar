import { useMemo } from 'react'
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import {
    Loader2,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Check,
    X,
    Clock,
    CheckCircle2,
    XCircle,
} from 'lucide-react'
import { Button } from '#/components/Button'
import { Chip } from '#/components/Chip'
import { useResources } from '#/hooks/useResorces'
import {
    useReservations,
    useUpdateReservation,
    type ReservationWithOccurrences,
    type ReservationStatus,
} from '#/hooks/useReservations'
import { startOfCurrentWeek } from '#/utils/calendarUtils'
import { cn } from '#/utils/cn'
import { readable_uuid } from '#/utils/uuid'
import { formatDate } from '#/utils/date'
import { api } from '#/api/client'
import { authKeys, fetchMe } from '#/hooks/useAuth'

export interface AdminDashboardSearch {
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

export const Route = createFileRoute('/admin/dashboard')({
    validateSearch: (search: Record<string, unknown>): AdminDashboardSearch => {
        return {
            start_date: typeof search.start_date === 'string' ? search.start_date : undefined,
            days: typeof search.days === 'number' ? search.days : undefined,
            resource_id: typeof search.resource_id === 'string' ? search.resource_id : undefined,
        }
    },
    beforeLoad: async ({ context }) => {
        const user = await context.queryClient.ensureQueryData({
            queryKey: authKeys.me(),
            queryFn: fetchMe,
            staleTime: 1000 * 60 * 5,
        })

        if (!user || user.role !== 'admin') {
            throw redirect({
                to: '/reservations',
                replace: true,
            })
        }
    },
    component: AdminDashboardPage,
})

function AdminReservationCard({
    reservation,
    onStatusChange,
    isUpdating,
}: {
    reservation: ReservationWithOccurrences
    onStatusChange: (status: ReservationStatus) => void
    isUpdating: boolean
}) {
    const firstOccurrence = reservation.occurrences?.[0]
    const isPending = reservation.status === 'pending'
    const isCancelled = reservation.status === 'cancelled'

    return (
        <li
            className={cn(
                'p-3 border-2 flex flex-col gap-2 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors',
                isPending
                    ? 'border-amber-400 dark:border-amber-600'
                    : isCancelled
                        ? 'border-rose-300 dark:border-rose-900/60 opacity-80'
                        : 'border-stone-200 dark:border-stone-700'
            )}
        >
            <div className="flex items-center gap-2 min-w-0">
                <Link
                    to="/reservations/$id"
                    params={{ id: reservation.id }}
                    className="font-bold truncate hover:underline text-stone-900 dark:text-stone-100 flex-1"
                >
                    {reservation.title}
                </Link>
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

            {/* Action Buttons Row */}
            <div className="flex items-center justify-end pt-2 border-t border-stone-200 dark:border-stone-800 gap-1.5">
                {isPending ? (
                    <>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => onStatusChange('cancelled' as ReservationStatus)}
                            className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs px-2.5 py-1"
                        >
                            <X size={14} />
                            <span>Hylkää</span>
                        </Button>
                        <Button
                            size="sm"
                            disabled={isUpdating}
                            onClick={() => onStatusChange('confirmed' as ReservationStatus)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-2.5 py-1"
                        >
                            <Check size={14} />
                            <span>Hyväksy</span>
                        </Button>
                    </>
                ) : (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isUpdating}
                        onClick={() => onStatusChange('pending' as ReservationStatus)}
                        className="text-stone-600 dark:text-stone-400 text-xs px-2.5 py-1"
                    >
                        <Clock size={14} />
                        <span>Palauta odottavaksi</span>
                    </Button>
                )}
            </div>
        </li>
    )
}

function AdminDashboardPage() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()

    const { data: resources, isLoading: loadingResources } = useResources()
    const updateReservation = useUpdateReservation()

    const defaultStartStr = formatYYYYMMDD(startOfCurrentWeek())
    const startStr = search.start_date || defaultStartStr
    const days = search.days || 14
    const resourceId = search.resource_id

    const start = useMemo(() => parseLocalDate(startStr), [startStr])

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

    // Categorize reservations into three status buckets
    const { pendingReservations, confirmedReservations, cancelledReservations } = useMemo(() => {
        if (!reservations)
            return {
                pendingReservations: [],
                confirmedReservations: [],
                cancelledReservations: [],
            }

        return {
            pendingReservations: reservations.filter((r) => r.status === 'pending'),
            confirmedReservations: reservations.filter((r) => r.status === 'confirmed'),
            cancelledReservations: reservations.filter((r) => r.status === 'cancelled'),
        }
    }, [reservations])

    const updateSearch = (next: AdminDashboardSearch) => {
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

    const handleStatusChange = async (id: string, status: ReservationStatus) => {
        await updateReservation.mutateAsync({
            id,
            payload: { status },
        })
    }

    return (
        <div className="flex flex-col gap-6 p-4 flex-1 min-h-0">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                    Ylläpidon hallintapaneeli
                </h1>
            </div>

            {/* Time-Range and Resource Selectors */}
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

                <select
                    value={resourceId || ''}
                    onChange={(e) => updateSearch({ resource_id: e.target.value || undefined })}
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

            {isLoading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-stone-500">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Ladataan hallintapaneelia...</span>
                </div>
            ) : isError ? (
                <div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
                    Virhe ladattaessa varaustietoja.
                </div>
            ) : (
                <div className="space-y-6">
                    {/* SECTION 1: Pending Approvals */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold">
                            <Clock size={18} />
                            <h2>Odottaa hyväksyntää ({pendingReservations.length})</h2>
                        </div>

                        {pendingReservations.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {pendingReservations.map((res) => (
                                    <AdminReservationCard
                                        key={res.id}
                                        reservation={res}
                                        onStatusChange={(s) => handleStatusChange(res.id, s)}
                                        isUpdating={updateReservation.isPending}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
                                Ei odottavia varauksia valitulla aikavälillä.
                            </div>
                        )}
                    </div>

                    {/* SECTION 2: Confirmed Reservations */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-bold">
                            <CheckCircle2 size={18} />
                            <h2>Vahvistetut varaukset ({confirmedReservations.length})</h2>
                        </div>

                        {confirmedReservations.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {confirmedReservations.map((res) => (
                                    <AdminReservationCard
                                        key={res.id}
                                        reservation={res}
                                        onStatusChange={(s) => handleStatusChange(res.id, s)}
                                        isUpdating={updateReservation.isPending}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
                                Ei vahvistettuja varauksia valitulla aikavälillä.
                            </div>
                        )}
                    </div>

                    {/* SECTION 3: Cancelled / Rejected Reservations */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-500 font-bold">
                            <XCircle size={18} />
                            <h2>Hylätyt ja perutut varaukset ({cancelledReservations.length})</h2>
                        </div>

                        {cancelledReservations.length > 0 ? (
                            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {cancelledReservations.map((res) => (
                                    <AdminReservationCard
                                        key={res.id}
                                        reservation={res}
                                        onStatusChange={(s) => handleStatusChange(res.id, s)}
                                        isUpdating={updateReservation.isPending}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
                                Ei hylättyjä varauksia valitulla aikavälillä.
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
