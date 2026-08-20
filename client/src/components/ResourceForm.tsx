// src/components/ResourceForm.tsx
import { useForm } from '@tanstack/react-form'
import { Loader2, Save } from 'lucide-react'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import { useCollections } from '#/hooks/useCollections'
import type { CreateResource } from '#/hooks/useResorces'

interface ResourceFormProps {
    defaultValues?: Partial<CreateResource>
    onSubmit: (values: CreateResource) => Promise<void>
    isSubmitting?: boolean
    submitLabel?: string
}

export function ResourceForm({
    defaultValues,
    onSubmit,
    isSubmitting = false,
    submitLabel = 'Tallenna',
}: ResourceFormProps) {
    const { data: collections, isLoading: loadingCollections } = useCollections()

    const form = useForm({
        defaultValues: {
            name: defaultValues?.name ?? '',
            collection_id: defaultValues?.collection_id ?? '',
        },
        onSubmit: async ({ value }) => {
            await onSubmit(value)
        },
    })

    if (loadingCollections) {
        return <div className="text-sm text-stone-500">Ladataan kokoelmia...</div>
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
            {/* Resource Name */}
            <form.Field
                name="name"
                validators={{
                    onChange: ({ value }) => (!value ? 'Nimi on pakollinen' : undefined),
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                Resurssin nimi
                            </label>
                            <Input
                                id={field.name}
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                isError={hasError}
                                placeholder="esim. Sauna 1"
                            />
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

            {/* Collection Selection */}
            <form.Field
                name="collection_id"
                validators={{
                    onChange: ({ value }) => (!value ? 'Valitse kokoelma' : undefined),
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                Kokoelma
                            </label>
                            <select
                                id={field.name}
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            >
                                <option value="" disabled>
                                    Valitse kokoelma...
                                </option>
                                {collections?.map((col) => (
                                    <option key={col.id} value={col.id}>
                                        {col.name}
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
