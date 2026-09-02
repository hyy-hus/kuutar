import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { UserForm, type UserFormValues } from '#/components/UserForm'
import { useUser, useUpdateUser } from '#/hooks/useUsers'

export const Route = createFileRoute('/_app/users/edit/$id')({
    component: EditUserPage,
})

function EditUserPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()
    const { data: user, isLoading } = useUser(id)
    const updateUser = useUpdateUser()

    if (isLoading) return <div className="p-4">Ladataan käyttäjää...</div>
    if (!user) return <div className="p-4">Käyttäjää ei löytynyt.</div>

    const handleSubmit = async (values: UserFormValues) => {
        await updateUser.mutateAsync({
            id: user.id,
            payload: {
                email: values.email,
                group_id: values.group_id,
                ...(values.password ? { password: values.password } : {}),
            },
        })
        navigate({ to: '/users/$id', params: { id: user.id } })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Muokkaa käyttäjää</h1>
            <UserForm
                defaultValues={{
                    email: user.email,
                    group_id: user.group_id,
                }}
                onSubmit={handleSubmit}
                isSubmitting={updateUser.isPending}
                submitLabel="Tallenna muutokset"
                isCreate={false}
            />
        </div>
    )
}
