import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { GroupForm } from '#/components/GroupForm'
import { useGroup, useUpdateGroup } from '#/hooks/useGroups'

export const Route = createFileRoute('/groups/edit/$id')({
    component: EditGroupPage,
})

function EditGroupPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: group, isLoading } = useGroup(id)
    const updateGroup = useUpdateGroup()

    if (isLoading) return <div className="p-4">Ladataan ryhmää...</div>
    if (!group) return <div className="p-4">Ryhmää ei löytynyt.</div>

    const handleSubmit = async (values: { name: string }) => {
        await updateGroup.mutateAsync({
            id: group.id,
            payload: values,
        })
        navigate({ to: '/groups/$id', params: { id: group.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Muokkaa ryhmää</h1>
            <GroupForm
                defaultValues={{
                    name: group.name,
                }}
                onSubmit={handleSubmit}
                isSubmitting={updateGroup.isPending}
                submitLabel="Tallenna muutokset"
            />
        </div>
    )
}
