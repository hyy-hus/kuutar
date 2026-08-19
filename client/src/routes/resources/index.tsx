import { Button } from '#/components/Button';
import { Chip } from '#/components/Chip';
import { useCollections, type Collection } from '#/hooks/useCollections';
import { useResources, type Resource } from '#/hooks/useResorces'
import { cn } from '#/utils/cn';
import { readable_uuid } from '#/utils/uuid';
import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, Folder, Loader2, Plus } from 'lucide-react';

export const Route = createFileRoute('/resources/')({
    component: RouteComponent,
})


function ResourceCard({ resource, collection }: { resource: Resource, collection?: Collection }) {
    return (
        <li className={cn('p-2 border-2 dark:border-stone-600 flex flex-col gap-1 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors')}>
            <div className='flex'>
                <h3 className='font-bold'>{resource.name}</h3>
                <span className='flex-1'></span>
                <Chip>{readable_uuid(resource.id)}</Chip>
            </div>
            {collection && (
                <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                    <Folder size={14} />
                    <Link
                        to="/collections/$id"
                        params={{ id: collection.id }}
                        className="hover:underline font-medium"
                    >
                        {collection.name}
                    </Link>
                </div>
            )}
            <p>
                Todo: show a description in here!
            </p>
            <div>
                <Button variant='secondary' size='sm' asChild>
                    <Link to="/resources/$id" params={{ id: resource.id }} className='hover:underline font-medium'>
                        Näytä
                        <Eye size={18} />
                    </Link>
                </Button>
            </div>
        </li>
    )
}

function ResourceList() {
    const { data: resources, isLoading: loadingResources, isError: errorResources } = useResources()
    const { data: collections, isLoading: loadingCollections, isError: errorCollections } = useCollections()

    if (loadingResources || loadingCollections) return <div><Loader2 className='animate-spin' /></div>
    if (errorResources || errorCollections) return <div>Virhe ladattaessa tietoja.</div>

    const collectionsMap = new Map(collections?.map((c) => [c.id, c]))

    return (
        <div className={cn('flex flex-col gap-2 p-2')}>
            <ul className={cn('grid grid-cols-2 gap-2')}>
                {resources?.map(res => (<ResourceCard key={res.id} resource={res} collection={collectionsMap.get(res.collection_id)} />))}
            </ul>
            <Button asChild>
                <Link to="/resources/create">
                    <span>Lisää resurssi</span>
                    <Plus size={18} />
                </Link>
            </Button>
        </div>
    )
}

function RouteComponent() {
    return <div><ResourceList /></div>
}
