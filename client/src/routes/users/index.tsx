import { createFileRoute, Link } from '@tanstack/react-router'
import { Eye, Loader2, Plus, Users } from 'lucide-react'
import { Button } from '#/components/Button'
import { Chip } from '#/components/Chip'
import { useUsers, type User } from '#/hooks/useUsers'
import { useGroups } from '#/hooks/useGroups'
import { cn } from '#/utils/cn'
import { readable_uuid } from '#/utils/uuid'

export const Route = createFileRoute('/users/')({
    component: RouteComponent,
})

function UserCard({ user, groupName }: { user: User; groupName?: string }) {
    return (
        <li className={cn('p-2 border-2 dark:border-stone-600 flex flex-col gap-1 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors')}>
            <div className="flex items-center">
                <h3 className="font-bold truncate">{user.email}</h3>
                <span className="flex-1" />
                <Chip>{readable_uuid(user.id)}</Chip>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
                <Users size={14} />
                <span>{groupName ?? 'Ei ryhmää'}</span>
            </div>

            <div className="pt-2">
                <Button variant="secondary" size="sm" asChild>
                    <Link to="/users/$id" params={{ id: user.id }} className="hover:underline font-medium">
                        <span>Näytä</span>
                        <Eye size={18} />
                    </Link>
                </Button>
            </div>
        </li>
    )
}

function UserList() {
    const { data: users, isLoading: loadingUsers, isError: errorUsers } = useUsers()
    const { data: groups, isLoading: loadingGroups } = useGroups()

    if (loadingUsers || loadingGroups) return <div><Loader2 className="animate-spin" /></div>
    if (errorUsers) return <div>Virhe ladattaessa tietoja.</div>

    const groupsMap = new Map(groups?.map((g) => [g.id, g.name]))

    return (
        <div className={cn('flex flex-col gap-2 p-2')}>
            <ul className={cn('grid grid-cols-2 gap-2')}>
                {users?.map((usr) => (
                    <UserCard key={usr.id} user={usr} groupName={groupsMap.get(usr.group_id)} />
                ))}
            </ul>
            <Button asChild>
                <Link to="/users/create">
                    <span>Rekisteröi käyttäjä</span>
                    <Plus size={18} />
                </Link>
            </Button>
        </div>
    )
}

function RouteComponent() {
    return <div><UserList /></div>
}
