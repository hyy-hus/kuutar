// src/routes/reservations/create.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ReservationForm, type ReservationFormValues } from '#/components/ReservationForm'
import { useCreateReservation } from '#/hooks/useReservations'

export const Route = createFileRoute('/_app/reservations/create')({
    component: CreateReservationPage,
})

function CreateReservationPage() {
    const navigate = useNavigate()
    const createReservation = useCreateReservation()

    const handleSubmit = async (values: ReservationFormValues) => {
        const created = await createReservation.mutateAsync({
            title: values.title,
            description: values.description || null,
            status: values.status,
            admin_notes: values.admin_notes || null,
            rrule: values.rrule || null,
            occurrences: values.occurrences ?? [],
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
