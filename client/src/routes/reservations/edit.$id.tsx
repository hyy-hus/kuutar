import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ReservationForm, type ReservationFormValues } from '#/components/ReservationForm'
import { useReservation, useUpdateReservation } from '#/hooks/useReservations'

export const Route = createFileRoute('/reservations/edit/$id')({
    component: EditReservationPage,
})

function EditReservationPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: reservation, isLoading } = useReservation(id)
    const updateReservation = useUpdateReservation()

    if (isLoading) return <div className="p-4">Ladataan varausta...</div>
    if (!reservation) return <div className="p-4">Varausta ei löytynyt.</div>

    const firstOccurrence = reservation.occurrences?.[0]

    const formatLocalISO = (isoStr?: string) => {
        if (!isoStr) return ''
        const date = new Date(isoStr)
        const offset = date.getTimezoneOffset()
        const localDate = new Date(date.getTime() - offset * 60 * 1000)
        return localDate.toISOString().slice(0, 16)
    }

    const handleSubmit = async (values: ReservationFormValues) => {
        await updateReservation.mutateAsync({
            id: reservation.id,
            payload: {
                title: values.title,
                description: values.description || null,
                status: values.status,
                admin_notes: values.admin_notes || null,
                rrule: values.rrule || null,
                occurrences: values.occurrences ?? [],
            },
        })
        navigate({ to: '/reservations/$id', params: { id: reservation.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Muokkaa varausta</h1>
            <ReservationForm
                defaultValues={{
                    title: reservation.title,
                    description: reservation.description ?? '',
                    status: reservation.status,
                    admin_notes: reservation.admin_notes ?? '',
                    rrule: reservation.rrule,
                    resource_id: firstOccurrence?.resource_id ?? '',
                    start_time: formatLocalISO(firstOccurrence?.start_time),
                    end_time: formatLocalISO(firstOccurrence?.end_time),
                }}
                onSubmit={handleSubmit}
                isSubmitting={updateReservation.isPending}
                submitLabel="Tallenna muutokset"
                isCreate={false}
            />
        </div>
    )
}
