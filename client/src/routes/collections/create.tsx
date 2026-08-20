import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CollectionForm } from '#/components/CollectionForm'
import { useCreateCollection } from '#/hooks/useCollections'

export const Route = createFileRoute('/collections/create')({
    component: CreateCollectionPage,
})

function CreateCollectionPage() {
    const navigate = useNavigate()
    const createCollection = useCreateCollection()

    const handleSubmit = async (values: { name: string }) => {
        const created = await createCollection.mutateAsync(values)
        navigate({ to: '/collections/$id', params: { id: created.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Uusi kokoelma</h1>
            <CollectionForm
                onSubmit={handleSubmit}
                isSubmitting={createCollection.isPending}
                submitLabel="Luo kokoelma"
            />
        </div>
    )
}
