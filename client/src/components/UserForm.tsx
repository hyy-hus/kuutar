import { useForm } from '@tanstack/react-form'
import { Loader2, Save } from 'lucide-react'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import { useGroups } from '#/hooks/useGroups'

export interface UserFormValues {
    email: string
    group_id: string
    password?: string
}

interface UserFormProps {
    defaultValues?: Partial<UserFormValues>
    onSubmit: (values: UserFormValues) => Promise<void>
    isSubmitting?: boolean
    submitLabel?: string
    isCreate?: boolean
}

export function UserForm({
    defaultValues,
    onSubmit,
    isSubmitting = false,
    submitLabel = 'Tallenna',
    isCreate = false,
}: UserFormProps) {
    const { data: groups, isLoading: loadingGroups } = useGroups()

    const form = useForm({
        defaultValues: {
            email: defaultValues?.email ?? '',
            group_id: defaultValues?.group_id ?? '',
            password: defaultValues?.password ?? '',
        },
        onSubmit: async ({ value }) => {
            await onSubmit(value)
        },
    })

    if (loadingGroups) {
        return <div className="text-sm text-stone-500">Ladataan ryhmiä...</div>
    }

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
            }}
            className="space-y-4 max-w-md"
        >
            {/* Email Field */}
            <form.Field
                name="email"
                validators={{
                    onChange: ({ value }) =>
                        !value
                            ? 'Sähköposti on pakollinen'
                            : !/\S+@\S+\.\S+/.test(value)
                                ? 'Anna kelvollinen sähköpostiosoite'
                                : undefined,
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                Sähköposti
                            </label>
                            <Input
                                id={field.name}
                                type="email"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                isError={hasError}
                                placeholder="nimi@esimerkki.fi"
                            />
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

            {/* Group Field */}
            <form.Field
                name="group_id"
                validators={{
                    onChange: ({ value }) => (!value ? 'Valitse ryhmä' : undefined),
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                Ryhmä
                            </label>
                            <select
                                id={field.name}
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="" disabled>
                                    Valitse ryhmä...
                                </option>
                                {groups?.map((grp) => (
                                    <option key={grp.id} value={grp.id}>
                                        {grp.name}
                                    </option>
                                ))}
                            </select>
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

            {/* Password Field */}
            <form.Field
                name="password"
                validators={{
                    onChange: ({ value }) =>
                        isCreate && !value
                            ? 'Salasana on pakollinen'
                            : value && value.length < 8
                                ? 'Salasanan on oltava vähintään 8 merkkiä'
                                : undefined,
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                {isCreate ? 'Salasana' : 'Uusi salasana (jätä tyhjäksi jos ei muuteta)'}
                            </label>
                            <Input
                                id={field.name}
                                type="password"
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                isError={hasError}
                                placeholder="••••••••"
                            />
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

            {/* Submit Button */}
            <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                {([canSubmit, formSubmitting]) => (
                    <Button
                        type="submit"
                        disabled={!canSubmit || isSubmitting || formSubmitting}
                        className="w-full flex items-center justify-center gap-2 mt-4"
                    >
                        {isSubmitting || formSubmitting ? (
                            <Loader2 className="animate-spin" size={16} />
                        ) : (
                            <>
                                <Save size={16} />
                                <span>{submitLabel}</span>
                            </>
                        )}
                    </Button>
                )}
            </form.Subscribe>
        </form>
    )
}
