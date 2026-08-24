import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Frequency } from 'rrule'
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Save } from 'lucide-react'
import { Input } from '#/components/Input'
import { Button } from '#/components/Button'
import { useResources } from '#/hooks/useResorces'
import {
    useCheckConflicts,
    type ReservationStatus,
    type Occurrence,
    type CreateOccurrencePayload,
} from '#/hooks/useReservations'
import { generateOccurrences, parseRRule } from '#/utils/rruleUtils'
import { formatDate } from '#/utils/date'

export interface ReservationFormValues {
    title: string
    description?: string
    status?: ReservationStatus
    admin_notes?: string
    resource_id?: string
    start_time?: string
    end_time?: string
    rrule?: string | null
    occurrences?: CreateOccurrencePayload[]
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
}: ReservationFormProps) {
    const { data: resources, isLoading: loadingResources } = useResources()
    const checkConflicts = useCheckConflicts()

    // Parse initial rrule if present
    const initialRule = parseRRule(defaultValues?.rrule)

    // Helper to format Date instance to YYYY-MM-DD string for input[type="date"]
    const formatDateInput = (date?: Date | null) => {
        if (!date) return ''
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const [freq, setFreq] = useState<Frequency | null>(initialRule.freq)
    const [untilStr, setUntilStr] = useState<string>(formatDateInput(initialRule.until))
    const [conflicts, setConflicts] = useState<Occurrence[] | null>(null)

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
            const until = untilStr ? new Date(untilStr) : null
            const { occurrences, rruleString } = generateOccurrences(
                value.start_time,
                value.end_time,
                value.resource_id,
                { freq, until }
            )

            await onSubmit({
                ...value,
                rrule: rruleString,
                occurrences,
            })
        },
    })

    const handleCheckConflicts = async () => {
        const until = untilStr ? new Date(untilStr) : null
        const { occurrences } = generateOccurrences(
            form.getFieldValue('start_time'),
            form.getFieldValue('end_time'),
            form.getFieldValue('resource_id'),
            { freq, until }
        )

        if (occurrences.length === 0) return

        const results = await checkConflicts.mutateAsync(occurrences)
        setConflicts(results)
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
                            {hasError && <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>}
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

            {/* Occurrence & Recurrence Section */}
            <div className="pt-3 border-t-2 border-stone-800 dark:border-stone-700 space-y-3">
                <h3 className="text-xs font-bold text-stone-900 dark:text-stone-100 uppercase tracking-wider">
                    Ajanvaraus ja Toistuvuus
                </h3>

                <form.Field
                    name="resource_id"
                    validators={{
                        onChange: ({ value }) => (!value ? 'Valitse resurssi' : undefined),
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
                                    onChange={(e) => {
                                        field.handleChange(e.target.value)
                                        setConflicts(null)
                                    }}
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
                                {hasError && <p className="text-[11px] text-red-500">{field.state.meta.errors.join(', ')}</p>}
                            </div>
                        )
                    }}
                </form.Field>

                <div className="grid grid-cols-2 gap-2">
                    <form.Field name="start_time">
                        {(field) => (
                            <div className="space-y-1">
                                <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                    Alkamisaika
                                </label>
                                <Input
                                    id={field.name}
                                    type="datetime-local"
                                    value={field.state.value}
                                    onChange={(e) => {
                                        field.handleChange(e.target.value)
                                        setConflicts(null)
                                    }}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="end_time">
                        {(field) => (
                            <div className="space-y-1">
                                <label htmlFor={field.name} className="text-xs font-medium text-stone-700 dark:text-stone-300">
                                    Päättymisaika
                                </label>
                                <Input
                                    id={field.name}
                                    type="datetime-local"
                                    value={field.state.value}
                                    onChange={(e) => {
                                        field.handleChange(e.target.value)
                                        setConflicts(null)
                                    }}
                                    onBlur={field.handleBlur}
                                />
                            </div>
                        )}
                    </form.Field>
                </div>

                {/* Recurrence Rule Fields */}
                <div className="p-3 bg-stone-100 dark:bg-stone-900 border-2 border-stone-800 dark:border-stone-700 rounded-sm space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-stone-800 dark:text-stone-200">
                        <RefreshCw size={14} />
                        <span>Toistuvuus</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <label htmlFor="recurrence_freq" className="text-[11px] text-stone-600 dark:text-stone-400">
                                Toistuvuusjakso
                            </label>
                            <select
                                id="recurrence_freq"
                                value={freq === null ? 'none' : freq}
                                onChange={(e) => {
                                    const val = e.target.value
                                    setFreq(val === 'none' ? null : Number(val))
                                    setConflicts(null)
                                }}
                                className="w-full px-2 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-sm"
                            >
                                <option value="none">Ei toistoa</option>
                                <option value={Frequency.DAILY}>Päivittäin</option>
                                <option value={Frequency.WEEKLY}>Viikoittain</option>
                                <option value={Frequency.MONTHLY}>Kuukausittain</option>
                                <option value={Frequency.YEARLY}>Vuosittain</option>
                            </select>
                        </div>

                        {freq !== null && (
                            <div className="space-y-1">
                                <label htmlFor="recurrence_until" className="text-[11px] text-stone-600 dark:text-stone-400">
                                    Toisto päättyy
                                </label>
                                <Input
                                    id="recurrence_until"
                                    type="date"
                                    value={untilStr}
                                    onChange={(e) => {
                                        setUntilStr(e.target.value)
                                        setConflicts(null)
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Conflict Check Action */}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCheckConflicts}
                    disabled={checkConflicts.isPending}
                    className="w-full flex items-center justify-center gap-2 text-xs font-mono"
                >
                    {checkConflicts.isPending ? (
                        <Loader2 className="animate-spin" size={14} />
                    ) : (
                        <span>Tarkista päällekkäisyydet</span>
                    )}
                </Button>

                {/* Conflict Check Results */}
                {conflicts !== null && (
                    <div>
                        {conflicts.length > 0 ? (
                            <div className="p-3 bg-rose-100 dark:bg-rose-950/80 border-2 border-rose-600 text-rose-900 dark:text-rose-200 rounded-sm space-y-2 text-xs">
                                <div className="flex items-center gap-2 font-bold">
                                    <AlertTriangle size={16} />
                                    <span>Löytyi {conflicts.length} päällekkäistä varausta!</span>
                                </div>
                                <ul className="list-disc list-inside space-y-1 font-mono text-[11px]">
                                    {conflicts.map((occ) => (
                                        <li key={occ.id}>
                                            {formatDate(occ.start_time)} – {formatDate(occ.end_time)}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ) : (
                            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/80 border-2 border-emerald-600 text-emerald-900 dark:text-emerald-200 rounded-sm flex items-center gap-2 text-xs font-medium">
                                <CheckCircle2 size={16} />
                                <span>Ei päällekkäisiä varauksia.</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

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
