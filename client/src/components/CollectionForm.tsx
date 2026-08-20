import { useForm } from '@tanstack/react-form'
import { Loader2, Save } from 'lucide-react'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import type { CreateCollection } from '#/hooks/useCollections'

interface CollectionFormProps {
    defaultValues?: Partial<CreateCollection>
    onSubmit: (values: CreateCollection) => Promise<void>
    isSubmitting?: boolean
    submitLabel?: string
}

export function CollectionForm({
    defaultValues,
    onSubmit,
    isSubmitting = false,
    submitLabel = 'Tallenna',
}: CollectionFormProps) {
    const form = useForm({
        defaultValues: {
            name: defaultValues?.name ?? '',
        },
        onSubmit: async ({ value }) => {
            await onSubmit(value)
        },
    })

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault()
                e.stopPropagation()
                form.handleSubmit()
            }}
            className="space-y-4 max-w-md"
        >
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
                                Kokoelman nimi
                            </label>
                            <Input
                                id={field.name}
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                isError={hasError}
                                placeholder="esim. Päärakennus"
                            />
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

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
