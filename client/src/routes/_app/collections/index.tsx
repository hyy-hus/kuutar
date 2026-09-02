import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, Loader2, Plus, Layers } from 'lucide-react'
import { Button } from '#/components/Button'
import { Chip } from '#/components/Chip'
import { useCollections, type Collection } from '#/hooks/useCollections'
import { useResources } from '#/hooks/useResorces'
import { cn } from '#/utils/cn'
import { readable_uuid } from '#/utils/uuid'

export const Route = createFileRoute('/_app/collections/')({
    component: RouteComponent,
})

function CollectionCard({
    collection,
    resourceCount,
}: {
    collection: Collection
    resourceCount: number
}) {
    return (
        <li className={cn('p-2 border-2 dark:border-stone-600 flex flex-col gap-1 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors')}>
            <div className="flex items-center">
                <h3 className="font-bold">{collection.name}</h3>
                <span className="flex-1" />
                <Chip>{readable_uuid(collection.id)}</Chip>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                <Layers size={14} />
                <span>{resourceCount} resurssia</span>
            </div>
            <p className="text-xs text-stone-400">
                Todo: show a description in here!
            </p>
            <div>
                <Button variant="secondary" size="sm" asChild>
                    <Link to="/collections/$id" params={{ id: collection.id }} className="hover:underline font-medium">
                        <span>Näytä</span>
                        <Eye size={18} />
                    </Link>
                </Button>
            </div>
        </li>
    )
}

function CollectionList() {
    const { data: collections, isLoading: loadingCollections, isError: errorCollections } = useCollections()
    const { data: resources, isLoading: loadingResources, isError: errorResources } = useResources()

    if (loadingCollections || loadingResources) return <div><Loader2 className="animate-spin" /></div>
    if (errorCollections || errorResources) return <div>Virhe ladattaessa tietoja.</div>

    // Count assigned resources per collection
    const resourceCounts = new Map<string, number>()
    resources?.forEach((res) => {
        const current = resourceCounts.get(res.collection_id) ?? 0
        resourceCounts.set(res.collection_id, current + 1)
    })

    return (
        <div className={cn('flex flex-col gap-2 p-2')}>
            <ul className={cn('grid grid-cols-2 gap-2')}>
                {collections?.map((col) => (
                    <CollectionCard
                        key={col.id}
                        collection={col}
                        resourceCount={resourceCounts.get(col.id) ?? 0}
                    />
                ))}
            </ul>
            <Button asChild>
                <Link to="/collections/create">
                    <span>Lisää kokoelma</span>
                    <Plus size={18} />
                </Link>
            </Button>
        </div>
    )
}

function RouteComponent() {
    return <div><CollectionList /></div>
}
