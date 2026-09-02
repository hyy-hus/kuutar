import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { Edit, Trash2, ArrowLeft, ShieldAlert, KeyRound } from 'lucide-react'
import { Button } from '#/components/Button'
import { useUser, useDeleteUser } from '#/hooks/useUsers'
import { useGroup } from '#/hooks/useGroups'
import { readable_uuid } from '#/utils/uuid'
import { Chip } from '#/components/Chip'
import { formatDate } from '#/utils/date'

export const Route = createFileRoute('/_app/users/$id')({
    component: ViewUserPage,
})

function ViewUserPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: user, isLoading, isError } = useUser(id)
    const { data: group } = useGroup(user?.group_id ?? '')
    const deleteUser = useDeleteUser()

    if (isLoading) return <div className="p-4 text-sm text-stone-500">Ladataan käyttäjää...</div>
    if (isError || !user) return <div className="p-4 text-sm text-red-500">Käyttäjää ei löytynyt.</div>

    const handleDelete = async () => {
        if (confirm('Haluatko varmasti poistaa tämän käyttäjän?')) {
            await deleteUser.mutateAsync(id)
            navigate({ to: '/users' })
        }
    }

    const handleRevokeSessions = async () => {
        if (confirm('Haluatko varmasti päättää kaikki tämän käyttäjän aktiiviset istunnot?')) {
            alert('Toteuta sessioiden mitätöinti backend-päätepisteen valmistuttua.')
        }
    }

    return (
        <div className="p-4 max-w-xl flex flex-col gap-6">
            <Link to="/users" className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline">
                <ArrowLeft size={14} /> Takaisin käyttäjiin
            </Link>

            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">{user.email}</h1>
                    <span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                        {user.role}
                    </span>
                </div>
                <Chip>{readable_uuid(user.id)}</Chip>
            </div>

            {/* Details */}
            <div className="space-y-2">
                <div className="text-md">
                    <p>
                        <strong>Ryhmä:</strong> {group?.name ?? '—'}
                    </p>
                    <hr className="my-2 border-stone-300 dark:border-stone-800" />
                    <p>
                        <strong>Muokattu:</strong> {formatDate(user.updated_at)}
                    </p>
                    <p>
                        <strong>Luotu:</strong> {formatDate(user.created_at)}
                    </p>
                </div>
            </div>

            {/* Active Sessions Box */}
            <div className="p-4 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900/50 space-y-3">
                <div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-semibold text-sm">
                    <KeyRound size={16} />
                    <span>Aktiiviset istunnot</span>
                </div>
                <p className="text-xs text-stone-500">
                    Käyttäjällä ei ole näkyviä aktiivisia istuntoja tai backend ei tue sessionhallintaa vielä.
                </p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRevokeSessions}
                    className="w-full flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900"
                >
                    <ShieldAlert size={16} />
                    <span>Mitätöi kaikki istunnot</span>
                </Button>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 pt-2">
                <Button variant="secondary" className="w-full flex items-center justify-center gap-2" asChild>
                    <Link to="/users/edit/$id" params={{ id: user.id }}>
                        <span>Muokkaa</span>
                        <Edit size={16} />
                    </Link>
                </Button>

                <Button
                    variant="danger"
                    className="w-full flex items-center justify-center gap-2"
                    onClick={handleDelete}
                    disabled={deleteUser.isPending}
                >
                    <span>Poista käyttäjä</span>
                    <Trash2 size={16} />
                </Button>
            </div>
        </div>
    )
}
