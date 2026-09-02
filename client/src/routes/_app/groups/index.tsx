import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, Loader2, Plus } from 'lucide-react'
import { Button } from '#/components/Button'
import { Chip } from '#/components/Chip'
import { useGroups, type Group } from '#/hooks/useGroups'
import { cn } from '#/utils/cn'
import { readable_uuid } from '#/utils/uuid'

export const Route = createFileRoute('/_app/groups/')({
    component: RouteComponent,
})

function GroupCard({ group }: { group: Group }) {
    return (
        <li className={cn('p-2 border-2 dark:border-stone-600 flex flex-col gap-1 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors')}>
            <div className="flex items-center">
                <h3 className="font-bold">{group.name}</h3>
                <span className="flex-1" />
                <Chip>{readable_uuid(group.id)}</Chip>
            </div>
            <p className="text-xs text-stone-400">
                Todo: show a description in here!
            </p>
            <div>
                <Button variant="secondary" size="sm" asChild>
                    <Link to="/groups/$id" params={{ id: group.id }} className="hover:underline font-medium">
                        <span>Näytä</span>
                        <Eye size={18} />
                    </Link>
                </Button>
            </div>
        </li>
    )
}

function GroupList() {
    const { data: groups, isLoading: loadingGroups, isError: errorGroups } = useGroups()

    if (loadingGroups) return <div><Loader2 className="animate-spin" /></div>
    if (errorGroups) return <div>Virhe ladattaessa tietoja.</div>

    return (
        <div className={cn('flex flex-col gap-2 p-2')}>
            <ul className={cn('grid grid-cols-2 gap-2')}>
                {groups?.map((grp) => (
                    <GroupCard key={grp.id} group={grp} />
                ))}
            </ul>
            <Button asChild>
                <Link to="/groups/create">
                    <span>Lisää ryhmä</span>
                    <Plus size={18} />
                </Link>
            </Button>
        </div>
    )
}

function RouteComponent() {
    return <div><GroupList /></div>
}
