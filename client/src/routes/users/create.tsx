import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { UserForm, type UserFormValues } from '#/components/UserForm'
import { useRegisterUser } from '#/hooks/useUsers'

export const Route = createFileRoute('/users/create')({
    component: CreateUserPage,
})

function CreateUserPage() {
    const navigate = useNavigate()
    const registerUser = useRegisterUser()

    const handleSubmit = async (values: UserFormValues) => {
        if (!values.password) return

        await registerUser.mutateAsync({
            email: values.email,
            group_id: values.group_id,
            password: values.password,
        })

        navigate({ to: '/users' })
    }

    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">Rekisteröi uusi käyttäjä</h1>
            <UserForm
                onSubmit={handleSubmit}
                isSubmitting={registerUser.isPending}
                submitLabel="Rekisteröi käyttäjä"
                isCreate={true}
            />
        </div>
    )
}
