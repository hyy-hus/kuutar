import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { CollectionForm } from '#/components/CollectionForm'
import { useCollection, useUpdateCollection } from '#/hooks/useCollections'

export const Route = createFileRoute('/_app/collections/edit/$id')({
    component: EditCollectionPage,
})

function EditCollectionPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: collection, isLoading } = useCollection(id)
    const updateCollection = useUpdateCollection()

    if (isLoading) return <div className="p-4">Ladataan kokoelmaa...</div>
    if (!collection) return <div className="p-4">Kokoelmaa ei löytynyt.</div>

    const handleSubmit = async (values: { name: string }) => {
        await updateCollection.mutateAsync({
            id: collection.id,
            payload: values,
        })
        navigate({ to: '/collections/$id', params: { id: collection.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Muokkaa kokoelmaa</h1>
            <CollectionForm
                defaultValues={{
                    name: collection.name,
                }}
                onSubmit={handleSubmit}
                isSubmitting={updateCollection.isPending}
                submitLabel="Tallenna muutokset"
            />
        </div>
    )
}
