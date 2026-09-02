import { useEffect, useRef } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '#/api/client'
import { useContracts } from '#/hooks/useContracts'
import { useResources } from '#/hooks/useResorces'
import { type ReservationWithOccurrences } from '#/hooks/useReservations'
import { formatDate } from '#/utils/date'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

export interface BatchPrintSearch {
    reservation_ids: string[]
    contract_id: string
}

export const Route = createFileRoute('/contracts/batch-print')({
    validateSearch: (search: Record<string, unknown>): BatchPrintSearch => ({
        reservation_ids: Array.isArray(search.reservation_ids)
            ? (search.reservation_ids as string[])
            : typeof search.reservation_ids === 'string'
                ? search.reservation_ids.split(',').filter(Boolean)
                : [],
        contract_id: String(search.contract_id || ''),
    }),
    component: BatchPrintPage,
})

function BatchPrintPage() {
    const { reservation_ids, contract_id } = Route.useSearch()
    const hasTriggeredPrint = useRef(false)

    const { data: contracts, isLoading: loadingContracts } = useContracts()
    const { data: resources, isLoading: loadingResources } = useResources()

    // Fetch exact reservations concurrently by ID with explicit return typing
    const { data: activeReservations, isLoading: loadingReservations, isError } = useQuery<ReservationWithOccurrences[]>({
        queryKey: ['reservations', 'batch', reservation_ids],
        queryFn: async () => {
            if (reservation_ids.length === 0) return []

            const results = await Promise.all(
                reservation_ids.map(async (id) => {
                    const { data, error } = await api.GET('/reservations/{id}', {
                        params: { path: { id } },
                    })
                    if (error || !data) return null
                    return data as unknown as ReservationWithOccurrences
                })
            )

            return results.filter((item): item is ReservationWithOccurrences => Boolean(item))
        },
        enabled: reservation_ids.length > 0,
    })

    const selectedContract = contracts?.find((c) => c.id === contract_id)
    const isReady =
        !loadingContracts &&
        !loadingResources &&
        !loadingReservations &&
        selectedContract &&
        activeReservations &&
        activeReservations.length > 0

    useEffect(() => {
        if (isReady && !hasTriggeredPrint.current) {
            hasTriggeredPrint.current = true
            const timer = setTimeout(() => {
                window.print()
            }, 500)
            return () => clearTimeout(timer)
        }
    }, [isReady])

    if (loadingContracts || loadingResources || loadingReservations) {
        return (
            <div className="p-8 text-center text-stone-500 font-mono text-sm">
                Ladataan erätulostusta...
            </div>
        )
    }

    if (isError || !selectedContract || !activeReservations || activeReservations.length === 0) {
        return (
            <div className="p-8 text-center text-rose-600 font-semibold text-sm">
                Sopimuspohjaa tai valittuja varauksia ei löytynyt.
            </div>
        )
    }

    let rawHtml = ''
    try {
        rawHtml =
            typeof selectedContract.body === 'string'
                ? JSON.parse(selectedContract.body)
                : generateHTML(selectedContract.body as any, [StarterKit, Link])
    } catch {
        rawHtml = String(selectedContract.body || '')
    }

    // Helper map to look up resource name by ID
    const resourceMap = new Map(resources?.map((r) => [r.id, r.name]) ?? [])

    return (
        <div className="bg-white text-stone-900 print:p-0">
            {activeReservations.map((item, index) => {
                if (!item) return null

                // Handle flattened reservation fields directly
                const res = item
                const occurrences = item.occurrences || []

                // Extract unique resource names for this reservation
                const resourceNames = Array.from(
                    new Set(
                        occurrences
                            .map((occ) => resourceMap.get(occ.resource_id) || occ.resource_id)
                            .filter(Boolean)
                    )
                ).join(', ')

                return (
                    <div
                        key={res.id}
                        className={`min-h-screen p-8 max-w-3xl mx-auto print:max-w-none print:p-0 ${index < activeReservations.length - 1 ? 'print:break-after-page' : ''
                            }`}
                        style={{
                            pageBreakAfter: index < activeReservations.length - 1 ? 'always' : 'auto',
                        }}
                    >
                        {/* Header */}
                        <div className="border-b-2 border-stone-900 pb-4 mb-6 flex justify-between items-start">
                            <div>
                                <h1 className="text-2xl font-black uppercase tracking-wide">
                                    {selectedContract.name}
                                </h1>
                                <p className="text-xs text-stone-500 mt-1">
                                    Sopimustunniste: {res.id}
                                </p>
                            </div>
                        </div>

                        {/* Info Box */}
                        <div className="mb-8 p-4 bg-stone-50 border border-stone-300 rounded-sm text-xs space-y-3">
                            <h2 className="font-bold text-sm text-stone-900 uppercase border-b border-stone-200 pb-1">
                                Varauksen Tiedot
                            </h2>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <span className="text-stone-500 block">Varaus:</span>
                                    <strong className="text-stone-900 font-semibold">
                                        {res.title}
                                    </strong>
                                </div>
                                <div>
                                    <span className="text-stone-500 block">Varattu kohde / tila:</span>
                                    <strong className="text-stone-900 font-semibold">
                                        {resourceNames || '—'}
                                    </strong>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-stone-200">
                                <span className="text-stone-500 block mb-1">Varausajat:</span>
                                <ul className="space-y-1">
                                    {occurrences.map((occ) => (
                                        <li key={occ.id} className="flex gap-2 font-mono text-[11px]">
                                            <span>{formatDate(occ.start_time)}</span>
                                            <span className="text-stone-400">→</span>
                                            <span>{formatDate(occ.end_time)}</span>
                                            {resourceMap.has(occ.resource_id) && (
                                                <span className="text-stone-500 ml-auto font-sans">
                                                    ({resourceMap.get(occ.resource_id)})
                                                </span>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Body Text */}
                        <div
                            className="prose max-w-none text-stone-900 text-sm leading-relaxed mb-12"
                            dangerouslySetInnerHTML={{ __html: rawHtml }}
                        />

                        {/* Signature Block - Forced Page Break in Print */}
                        <div
                            className="pt-12 mt-12 border-t border-stone-400 print:break-before-page print:pt-12"
                            style={{ pageBreakBefore: 'always', breakBefore: 'page' }}
                        >
                            <h2 className="font-bold text-sm text-stone-900 uppercase tracking-wide mb-8">
                                Allekirjoitukset
                            </h2>

                            <div className="grid grid-cols-2 gap-12">
                                <div className="space-y-10">
                                    <div className="border-b border-stone-400 h-8" />
                                    <p className="text-xs text-stone-600 font-bold">Vuokranantaja</p>
                                </div>
                                <div className="space-y-10">
                                    <div className="border-b border-stone-400 h-8" />
                                    <p className="text-xs text-stone-600 font-bold">Vuokralainen</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
