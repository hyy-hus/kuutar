import { useForm } from '@tanstack/react-form'
import { Loader2, Save } from 'lucide-react'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import { useResources } from '#/hooks/useResorces'
import type { ReservationStatus } from '#/hooks/useReservations'

export interface ReservationFormValues {
    title: string
    description?: string
    status?: ReservationStatus
    admin_notes?: string
    resource_id?: string
    start_time?: string
    end_time?: string
}

interface ReservationFormProps {
    defaultValues?: Partial<ReservationFormValues>
    onSubmit: (values: ReservationFormValues) => Promise<void>
    isSubmitting?: boolean
    submitLabel?: string
    isCreate?: boolean
}

export function ReservationForm({
    defaultValues,
    onSubmit,
    isSubmitting = false,
    submitLabel = 'Tallenna',
    isCreate = false,
}: ReservationFormProps) {
    const { data: resources, isLoading: loadingResources } = useResources()

    const form = useForm({
        defaultValues: {
            title: defaultValues?.title ?? '',
            description: defaultValues?.description ?? '',
            status: defaultValues?.status ?? ('confirmed' as ReservationStatus),
            admin_notes: defaultValues?.admin_notes ?? '',
            resource_id: defaultValues?.resource_id ?? '',
            start_time: defaultValues?.start_time ?? '',
            end_time: defaultValues?.end_time ?? '',
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
            {/* Title */}
            <form.Field
                name="title"
                validators={{
                    onChange: ({ value }) => (!value ? 'Otsikko on pakollinen' : undefined),
                }}
            >
                {(field) => {
                    const hasError = Boolean(field.state.meta.errors.length)
                    return (
                        <div className="space-y-1">
                            <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                Otsikko
                            </label>
                            <Input
                                id={field.name}
                                value={field.state.value}
                                onChange={(e) => field.handleChange(e.target.value)}
                                onBlur={field.handleBlur}
                                isError={hasError}
                                placeholder="esim. Viikkokokous"
                            />
                            {hasError && (
                                <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>
                            )}
                        </div>
                    )
                }}
            </form.Field>

            {/* Description */}
            <form.Field name="description">
                {(field) => (
                    <div className="space-y-1">
                        <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                            Kuvaus
                        </label>
                        <Input
                            id={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="Lisätiedot..."
                        />
                    </div>
                )}
            </form.Field>

            {/* Status */}
            <form.Field name="status">
                {(field) => (
                    <div className="space-y-1">
                        <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                            Tila
                        </label>
                        <select
                            id={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value as ReservationStatus)}
                            onBlur={field.handleBlur}
                            className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                        >
                            <option value="confirmed">Vahvistettu</option>
                            <option value="pending">Odottaa</option>
                            <option value="cancelled">Peruttu</option>
                        </select>
                    </div>
                )}
            </form.Field>

            {/* Admin Notes */}
            <form.Field name="admin_notes">
                {(field) => (
                    <div className="space-y-1">
                        <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                            Ylläpitäjän muistiinpanot
                        </label>
                        <Input
                            id={field.name}
                            value={field.state.value}
                            onChange={(e) => field.handleChange(e.target.value)}
                            onBlur={field.handleBlur}
                            placeholder="Vain ylläpidolle näkyvät merkinnät"
                        />
                    </div>
                )}
            </form.Field>

            {/* Initial Occurrence details on creation */}
            {isCreate && (
                <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-3">
                    <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Ajanvaraus</h3>

                    <form.Field
                        name="resource_id"
                        validators={{
                            onChange: ({ value }) => (isCreate && !value ? 'Valitse resurssi' : undefined),
                        }}
                    >
                        {(field) => {
                            const hasError = Boolean(field.state.meta.errors.length)
                            return (
                                <div className="space-y-1">
                                    <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                        Resurssi
                                    </label>
                                    <select
                                        id={field.name}
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        onBlur={field.handleBlur}
                                        disabled={loadingResources}
                                        className="w-full px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    >
                                        <option value="" disabled>
                                            {loadingResources ? 'Ladataan resursseja...' : 'Valitse resurssi...'}
                                        </option>
                                        {resources?.map((res) => (
                                            <option key={res.id} value={res.id}>
                                                {res.name}
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

                    <form.Field
                        name="start_time"
                        validators={{
                            onChange: ({ value }) => (isCreate && !value ? 'Alpuaika on pakollinen' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="space-y-1">
                                <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                    Alkamisaika
                                </label>
                                <Input
                                    id={field.name}
                                    type="datetime-local"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field
                        name="end_time"
                        validators={{
                            onChange: ({ value }) => (isCreate && !value ? 'Päättymisaika on pakollinen' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="space-y-1">
                                <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                    Päättymisaika
                                </label>
                                <Input
                                    id={field.name}
                                    type="datetime-local"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        )}
                    </form.Field>
                </div>
            )}

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
