import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ReservationForm, type ReservationFormValues } from '#/components/ReservationForm'
import { useCreateReservation } from '#/hooks/useReservations'

export const Route = createFileRoute('/reservations/create')({
    component: CreateReservationPage,
})

function CreateReservationPage() {
    const navigate = useNavigate()
    const createReservation = useCreateReservation()

    const handleSubmit = async (values: ReservationFormValues) => {
        const occurrences =
            values.resource_id && values.start_time && values.end_time
                ? [
                    {
                        resource_id: values.resource_id,
                        start_time: new Date(values.start_time).toISOString(),
                        end_time: new Date(values.end_time).toISOString(),
                    },
                ]
                : []

        const created = await createReservation.mutateAsync({
            title: values.title,
            description: values.description || null,
            status: values.status,
            admin_notes: values.admin_notes || null,
            occurrences,
        })

        navigate({ to: '/reservations/$id', params: { id: created.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Uusi varaus</h1>
            <ReservationForm
                onSubmit={handleSubmit}
                isSubmitting={createReservation.isPending}
                submitLabel="Luo varaus"
                isCreate={true}
            />
        </div>
    )
}
