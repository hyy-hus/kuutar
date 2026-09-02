import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, Save, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react'
import { Button } from '#/components/Button'
import { ContractEditor } from '#/components/ContractEditor'
import { useContracts, useUpdateContract } from '#/hooks/useContracts'
import { generateHTML } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'

export const Route = createFileRoute('/_app/contracts/$id')({
    component: EditContractPage,
})

function EditContractPage() {
    const { id } = Route.useParams()
    const navigate = useNavigate()

    const { data: contracts, isLoading } = useContracts()
    const updateContract = useUpdateContract()

    const [title, setTitle] = useState('')
    const [contentHtml, setContentHtml] = useState('')
    const [isInitialized, setIsInitialized] = useState(false)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const contract = contracts?.find((c) => c.id === id)

    // Populate editor fields when contract data is loaded
    useEffect(() => {
        if (contract && !isInitialized) {
            setTitle(contract.name)

            let rawHtml = ''
            try {
                rawHtml =
                    typeof contract.body === 'string'
                        ? JSON.parse(contract.body)
                        : generateHTML(contract.body as any, [StarterKit, Link])
            } catch {
                rawHtml = String(contract.body || '')
            }

            setContentHtml(rawHtml)
            setIsInitialized(true)
        }
    }, [contract, isInitialized])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!title.trim()) return

        try {
            await updateContract.mutateAsync({
                id,
                payload: {
                    name: title.trim(),
                    body: JSON.stringify(contentHtml),
                },
            })

            setSuccessMessage('Sopimuspohja päivitetty onnistuneesti!')

            setTimeout(() => {
                setSuccessMessage(null)
            }, 3000)
        } catch (err) {
            console.error('Sopimuspohjan päivitys epäonnistui:', err)
        }
    }

    if (isLoading) {
        return (
            <div className="p-8 flex items-center justify-center gap-2 text-stone-500">
                <Loader2 className="animate-spin" size={18} />
                <span>Ladataan sopimuspohjaa...</span>
            </div>
        )
    }

    if (!contract) {
        return (
            <div className="p-8 text-center text-rose-600 font-semibold text-sm">
                Sopimuspohjaa ei löytynyt.
            </div>
        )
    }

    return (
        <form onSubmit={handleSave} className="flex flex-col gap-4 p-4 max-w-4xl mx-auto flex-1 w-full">
            {/* Navigation / Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate({ to: '/contracts' })}
                        title="Takaisin listaukseen"
                    >
                        <ArrowLeft size={20} />
                    </Button>

                    <div className="flex items-center gap-2">
                        <FileText className="text-amber-600 dark:text-amber-500" size={24} />
                        <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                            Muokkaa sopimuspohjaa
                        </h1>
                    </div>
                </div>

                <Button
                    type="submit"
                    disabled={!title.trim() || updateContract.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                    {updateContract.isPending ? (
                        <Loader2 className="animate-spin" size={16} />
                    ) : (
                        <Save size={16} />
                    )}
                    <span>Tallenna muutokset</span>
                </Button>
            </div>

            {/* Feedback Messages */}
            {successMessage && (
                <div className="flex items-center gap-2 p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md">
                    <CheckCircle2 size={16} />
                    <span>{successMessage}</span>
                </div>
            )}

            {updateContract.isError && (
                <div className="p-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
                    {updateContract.error.message || 'Sopimuspohjan päivitys epäonnistui.'}
                </div>
            )}

            {/* Title Field */}
            <div className="flex flex-col gap-1.5">
                <label htmlFor="contract-title" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Sopimuspohjan nimi
                </label>
                <input
                    id="contract-title"
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
            </div>

            {/* Rich Text Editor */}
            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Sopimuksen sisältö
                </label>
                {isInitialized && (
                    <ContractEditor value={contentHtml} onChange={setContentHtml} />
                )}
            </div>
        </form>
    )
}
