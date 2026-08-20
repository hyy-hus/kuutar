// src/routes/resources/create.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ResourceForm } from '#/components/ResourceForm'
import { useCreateResource } from '#/hooks/useResorces'

export const Route = createFileRoute('/resources/create')({
    component: CreateResourcePage,
})

function CreateResourcePage() {
    const navigate = useNavigate()
    const createResource = useCreateResource()

    const handleSubmit = async (values: { name: string; collection_id: string }) => {
        const created = await createResource.mutateAsync(values)
        navigate({ to: '/resources/$id', params: { id: created.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Uusi resurssi</h1>
            <ResourceForm
                onSubmit={handleSubmit}
                isSubmitting={createResource.isPending}
                submitLabel="Luo resurssi"
            />
        </div>
    )
}
