// src/routes/resources/edit.$id.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ResourceForm } from '#/components/ResourceForm'
import { useResource, useUpdateResource } from '#/hooks/useResorces'

export const Route = createFileRoute('/resources/edit/$id')({
    component: EditResourcePage,
})

function EditResourcePage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: resource, isLoading } = useResource(id)
    const updateResource = useUpdateResource()

    if (isLoading) return <div className="p-4">Ladataan resurssia...</div>
    if (!resource) return <div className="p-4">Resurssia ei löytynyt.</div>

    const handleSubmit = async (values: { name: string; collection_id: string }) => {
        await updateResource.mutateAsync({
            id: resource.id,
            payload: values,
        })
        navigate({ to: '/resources/$id', params: { id: resource.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Muokkaa resurssia</h1>
            <ResourceForm
                defaultValues={{
                    name: resource.name,
                    collection_id: resource.collection_id,
                }}
                onSubmit={handleSubmit}
                isSubmitting={updateResource.isPending}
                submitLabel="Tallenna muutokset"
            />
        </div>
    )
}
