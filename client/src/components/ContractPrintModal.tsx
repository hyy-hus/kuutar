import { useState } from 'react'
import { FileText, Printer, X, Loader2 } from 'lucide-react'
import { Button } from '#/components/Button'
import { useContracts, type Contract } from '#/hooks/useContracts'
import type { ReservationWithOccurrences } from '#/hooks/useReservations'
import { formatDate } from '#/utils/date'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Mention from '@tiptap/extension-mention'
import Link from '@tiptap/extension-link'
import { mentionSuggestion } from '#/components/MentionSuggestion'

interface ContractPrintModalProps {
    reservation: ReservationWithOccurrences
    onClose: () => void
}

/** Converts Tiptap JSON or raw string body into HTML string */
function renderContractBody(body: unknown): string {
    if (typeof body === 'string') return body
    if (body && typeof body === 'object') {
        try {
            return generateHTML(body as any, [
                StarterKit,
                Link,
                Mention.configure({ suggestion: mentionSuggestion }),
            ])
        } catch {
            return ''
        }
    }
    return ''
}

/** Replaces variable tags like [[reserver_name]] with reservation data */
function hydrateContractTemplate(
    templateHtml: string,
    reservation: ReservationWithOccurrences
): string {
    const occ = reservation.occurrences?.[0]

    const replacements: Record<string, string> = {
        reserver_name: reservation.user?.name ?? '—',
        reserver_email: reservation.user?.email ?? '—',
        resource_name: occ?.resource_name ?? '—',
        start_time: occ ? formatDate(occ.start_time) : '—',
        end_time: occ ? formatDate(occ.end_time) : '—',
        total_price: reservation.total_price != null ? `${reservation.total_price} €` : '—',
    }

    return templateHtml.replace(/\[\[(\w+)\]\]/g, (match, key) => {
        return replacements[key] ?? match
    })
}

export function ContractPrintModal({ reservation, onClose }: ContractPrintModalProps) {
    const { data: contracts, isLoading } = useContracts()
    const [selectedContractId, setSelectedContractId] = useState<string>('')

    const selectedContract = contracts?.find((c) => c.id === selectedContractId)

    const renderedHtml = selectedContract
        ? hydrateContractTemplate(renderContractBody(selectedContract.body), reservation)
        : ''

    const handlePrint = () => {
        window.print()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/60 p-4 backdrop-blur-sm print:p-0 print:bg-white print:static">
            <div className="flex flex-col w-full max-w-3xl max-h-[90vh] bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-2xl overflow-hidden print:max-w-none print:max-h-none print:border-none print:shadow-none print:rounded-none print:bg-white print:text-black">
                {/* Modal Header (Hidden during print) */}
                <div className="flex items-center justify-between p-4 border-b border-stone-200 dark:border-stone-800 print:hidden bg-stone-100 dark:bg-stone-950">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className="text-amber-600 dark:text-amber-500" />
                        <h2 className="font-bold text-stone-900 dark:text-stone-100">
                            Tulosta sopimus varaukselle
                        </h2>
                    </div>
                    <Button variant="outline" size="sm" onClick={onClose} className="p-1">
                        <X size={16} />
                    </Button>
                </div>

                {/* Template Selection Controls (Hidden during print) */}
                <div className="p-4 border-b border-stone-200 dark:border-stone-800 bg-stone-100/50 dark:bg-stone-900/50 flex flex-wrap items-center gap-3 print:hidden">
                    <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                        Valitse sopimuspohja:
                    </label>
                    <select
                        value={selectedContractId}
                        onChange={(e) => setSelectedContractId(e.target.value)}
                        disabled={isLoading}
                        className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 flex-1 min-w-[200px]"
                    >
                        <option value="">-- Valitse sopimus --</option>
                        {contracts?.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>

                    <Button
                        size="sm"
                        disabled={!selectedContract}
                        onClick={handlePrint}
                        className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                    >
                        <Printer size={16} />
                        <span>Tulosta</span>
                    </Button>
                </div>

                {/* Printable Document Body */}
                <div className="flex-1 overflow-y-auto p-6 bg-white text-stone-900 print:overflow-visible print:p-0">
                    {isLoading ? (
                        <div className="p-8 flex items-center justify-center gap-2 text-stone-500">
                            <Loader2 className="animate-spin" size={18} />
                            <span>Haetaan sopimuspohjia...</span>
                        </div>
                    ) : !selectedContract ? (
                        <div className="p-8 text-center text-sm text-stone-400 border border-dashed border-stone-300 rounded-md">
                            Valitse sopimuspohja valikosta esikatsellaksesi täytettyä asiakirjaa.
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Formatted Rich-Text Content */}
                            <div
                                className="prose max-w-none text-stone-900 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h2]:text-xl [&_h2]:font-bold [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                                dangerouslySetInnerHTML={{ __html: renderedHtml }}
                            />

                            {/* Signature Block (Appears at bottom of contract) */}
                            <div className="pt-12 mt-12 border-t border-stone-300 grid grid-cols-2 gap-8 print:pt-16">
                                <div className="space-y-12">
                                    <div className="border-b border-stone-400 h-8" />
                                    <div className="text-xs text-stone-600">
                                        <p className="font-bold text-stone-900">Vuokranantaja</p>
                                        <p>Päiväys ja allekirjoitus</p>
                                    </div>
                                </div>
                                <div className="space-y-12">
                                    <div className="border-b border-stone-400 h-8" />
                                    <div className="text-xs text-stone-600">
                                        <p className="font-bold text-stone-900">Vuokralainen</p>
                                        <p>{reservation.user?.name ?? '—'}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
