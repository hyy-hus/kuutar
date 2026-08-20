import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Edit, Trash2, ArrowLeft } from 'lucide-react'
import { Button } from '#/components/Button'
import { useCollection, useDeleteCollection } from '#/hooks/useCollections'
import { readable_uuid } from '#/utils/uuid'
import { Chip } from '#/components/Chip'
import { formatDate } from '#/utils/date'

export const Route = createFileRoute('/collections/$id')({
    component: ViewCollectionPage,
})

function ViewCollectionPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: collection, isLoading, isError } = useCollection(id)
    const deleteCollection = useDeleteCollection()

    if (isLoading) return <div className="p-4 text-sm text-stone-500">Ladataan kokoelmaa...</div>
    if (isError || !collection) return <div className="p-4 text-sm text-red-500">Kokoelmaa ei löytynyt.</div>

    const handleDelete = async () => {
        if (confirm('Haluatko varmasti poistaa tämän kokoelman?')) {
            await deleteCollection.mutateAsync(id)
            navigate({ to: '/collections' })
        }
    }

    return (
        <div className="p-4 max-w-xl flex flex-col gap-6">
            {/* Back navigation */}
            <Link to="/collections" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">
                <ArrowLeft size={14} /> Takaisin kokoelmiin
            </Link>

            {/* 1. Header: Name & ID Chip */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{collection.name}</h1>
                <Chip>{readable_uuid(collection.id)}</Chip>
            </div>

            <div className="space-y-2">
                <div className="text-md">
                    <p>
                        <strong>Muokattu:</strong> {formatDate(collection.updated_at)}
                    </p>
                    <p>
                        <strong>Luotu:</strong> {formatDate(collection.created_at)}
                    </p>
                </div>
            </div>

            {/* 3. Vertically Stacked Action Buttons */}
            <div className="flex flex-col gap-2 pt-2">
                <Button variant="secondary" className="w-full flex items-center justify-center gap-2" asChild>
                    <Link to="/collections/edit/$id" params={{ id: collection.id }}>
                        <span>Muokkaa</span>
                        <Edit size={16} />
                    </Link>
                </Button>

                <Button
                    variant="danger"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleDelete}
                    disabled={deleteCollection.isPending}
                >
                    <span>Poista kokoelma</span>
                    <Trash2 size={16} />
                </Button>
            </div>
        </div>
    )
}
