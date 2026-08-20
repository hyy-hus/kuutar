import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, Loader2, Plus, Calendar } from 'lucide-react'
import { Button } from '#/components/Button'
import { Chip } from '#/components/Chip'
import { useReservations, type ReservationWithOccurrences } from '#/hooks/useReservations'
import { cn } from '#/utils/cn'
import { readable_uuid } from '#/utils/uuid'
import { formatDate } from '#/utils/date'

export const Route = createFileRoute('/reservations/')({
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
    const { data: reservations, isLoading, isError } = useReservations()

    if (isLoading) return <div><Loader2 className="animate-spin" /></div>
    if (isError) return <div>Virhe ladattaessa varauksia.</div>

    return (
        <div className={cn('flex flex-col gap-2 p-2')}>
            <ul className={cn('grid grid-cols-2 gap-2')}>
                {reservations?.map((res) => (
                    <ReservationCard key={res.id} reservation={res} />
                ))}
            </ul>
            <Button asChild>
                <Link to="/reservations/create">
                    <span>Lisää varaus</span>
                    <Plus size={18} />
                </Link>
            </Button>
        </div>
    )
}

function RouteComponent() {
    return <div><ReservationList /></div>
}
