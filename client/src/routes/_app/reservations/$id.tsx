import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Edit, Trash2, ArrowLeft, Clock } from 'lucide-react'
import { Button } from '#/components/Button'
import { useReservation, useDeleteReservation, type ReservationStatus } from '#/hooks/useReservations'
import { useResources } from '#/hooks/useResorces'
import { readable_uuid } from '#/utils/uuid'
import { Chip } from '#/components/Chip'
import { formatDate } from '#/utils/date'

export const Route = createFileRoute('/_app/reservations/$id')({
    component: ViewReservationPage,
})

function ViewReservationPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()

    // Validate that id is not "me" or a reserved keyword before querying
    const isValidUuid = Boolean(id && id !== 'me' && id.length > 8)

    const { data: reservationWithOcc, isLoading, isError } = useReservation(
        isValidUuid ? id : ''
    )
    const { data: resources } = useResources()
    const deleteReservation = useDeleteReservation()

    if (!isValidUuid || isError || (!isLoading && !reservationWithOcc)) {
        return (
            <div className="p-4 flex flex-col gap-4">
                <Link to="/reservations" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">
                    <ArrowLeft size={14} /> Takaisin varauksiin
                </Link>
                <div className="p-4 text-xs font-mono text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
                    Varausta ei löytynyt tai virheellinen Tunniste.
                </div>
            </div>
        )
    }

    if (isLoading) {
        return <div className="p-4 text-sm text-stone-500">Ladataan varausta...</div>
    }

    // Safely extract nested reservation and occurrences
    const reservation = reservationWithOcc
    const occurrences = reservationWithOcc?.occurrences ?? []

    const resourcesMap = new Map(resources?.map((r) => [r.id, r.name]))

    const handleDelete = async () => {
        if (confirm('Haluatko varmasti poistaa tämän varauksen?')) {
            await deleteReservation.mutateAsync(id)
            navigate({ to: '/reservations' })
        }
    }

    return (
        <div className="p-4 max-w-xl flex flex-col gap-6">
            <Link to="/reservations" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">
                <ArrowLeft size={14} /> Takaisin varauksiin
            </Link>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{reservation?.title}</h1>
                    <StatusBadge status={reservation?.status ?? 'pending'} />
                </div>
                <Chip>{readable_uuid(reservation?.id)}</Chip>
            </div>

            {/* Occurrences / Reserved Times */}
            {occurrences.length > 0 && (
                <div className="space-y-2">
                    <h2 className="text-xs uppercase tracking-wider text-stone-400 font-semibold">Varausajat</h2>
                    <ul className="space-y-2">
                        {occurrences.map((occ) => (
                            <li
                                key={occ.id}
                                className="p-3 bg-stone-50 dark:bg-stone-900 rounded-md border border-stone-200 dark:border-stone-800 text-xs space-y-1"
                            >
                                <div className="font-semibold text-stone-800 dark:text-stone-200">
                                    {resourcesMap.get(occ.resource_id) ?? 'Tuntematon resurssi'}
                                </div>
                                <div className="flex items-center gap-2 text-stone-500">
                                    <Clock size={14} />
                                    <span>
                                        {formatDate(occ.start_time)} – {formatDate(occ.end_time)}
                                    </span>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Details */}
            <div className="space-y-2">
                <div className="text-md space-y-1">
                    {reservation?.description && (
                        <p>
                            <strong>Kuvaus:</strong> {reservation.description}
                        </p>
                    )}
                    {reservation?.admin_notes && (
                        <p>
                            <strong>Ylläpidon muistiinpanot:</strong> {reservation.admin_notes}
                        </p>
                    )}
                    <hr className="my-2 border-stone-300 dark:border-stone-800" />
                    <p>
                        <strong>Muokattu:</strong> {formatDate(reservation?.updated_at)}
                    </p>
                    <p>
                        <strong>Luotu:</strong> {formatDate(reservation?.created_at)}
                    </p>
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
                <Button variant="secondary" className="w-full flex items-center justify-center gap-2" asChild>
                    <Link to="/reservations/edit/$id" params={{ id: reservation?.id ?? '' }}>
                        <span>Muokkaa</span>
                        <Edit size={16} />
                    </Link>
                </Button>

                <Button
                    variant="danger"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleDelete}
                    disabled={deleteReservation.isPending}
                >
                    <span>Poista varaus</span>
                    <Trash2 size={16} />
                </Button>
            </div>
        </div>
    )
}

function StatusBadge({ status }: { status: ReservationStatus }) {
    const styles = {
        confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300',
        pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300',
        cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300',
    }

    const labels = {
        confirmed: 'Vahvistettu',
        pending: 'Odottaa',
        cancelled: 'Peruttu',
    }

    return (
        <span className={`px-2 py-0.5 border text-xs font-medium rounded-sm ${styles[status]}`}>
            {labels[status]}
        </span>
    )
}
