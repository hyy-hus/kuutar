import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { GroupForm } from '#/components/GroupForm'
import { useCreateGroup } from '#/hooks/useGroups'

export const Route = createFileRoute('/groups/create')({
    component: CreateGroupPage,
})

function CreateGroupPage() {
    const navigate = useNavigate()
    const createGroup = useCreateGroup()

    const handleSubmit = async (values: { name: string }) => {
        const created = await createGroup.mutateAsync(values)
        navigate({ to: '/groups/$id', params: { id: created.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Uusi ryhmä</h1>
            <GroupForm
                onSubmit={handleSubmit}
                isSubmitting={createGroup.isPending}
                submitLabel="Luo ryhmä"
            />
        </div>
    )
}
