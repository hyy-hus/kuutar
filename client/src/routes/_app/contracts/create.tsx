import { useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { FileText, Save, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '#/components/Button'
import { ContractEditor } from '#/components/ContractEditor'
import { useCreateContract } from '#/hooks/useContracts'

export const Route = createFileRoute('/_app/contracts/create')({
    component: CreateContractPage,
})

function CreateContractPage() {
    const navigate = useNavigate()
    const [title, setTitle] = useState('')
    const [contentHtml, setContentHtml] = useState('')
    const [successMessage, setSuccessMessage] = useState<string | null>(null)

    const createContract = useCreateContract()

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!title.trim()) return

        try {
            await createContract.mutateAsync({
                name: title.trim(),
                body: JSON.stringify(contentHtml),
            })

            setSuccessMessage('Sopimuspohja tallennettu onnistuneesti!')
            setTimeout(() => {
                navigate({ to: '/contracts' })
            }, 1000)
        } catch (err) {
            console.error('Sopimuspohjan tallennus epäonnistui:', err)
        }
    }

    return (
        <form onSubmit={handleSave} className="flex flex-col gap-4 p-4 max-w-4xl mx-auto flex-1 w-full">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <FileText className="text-amber-600 dark:text-amber-500" size={24} />
                    <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                        Uusi sopimuspohja
                    </h1>
                </div>

                <Button
                    type="submit"
                    disabled={!title.trim() || createContract.isPending}
                    className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
                >
                    {createContract.isPending ? (
                        <Loader2 className="animate-spin" size={16} />
                    ) : (
                        <Save size={16} />
                    )}
                    <span>Tallenna sopimuspohja</span>
                </Button>
            </div>

            {successMessage && (
                <div className="flex items-center gap-2 p-3 text-sm text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-md">
                    <CheckCircle2 size={16} />
                    <span>{successMessage}</span>
                </div>
            )}

            <div className="flex flex-col gap-1.5">
                <label htmlFor="contract-title" className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Sopimuspohjan nimi
                </label>
                <input
                    id="contract-title"
                    type="text"
                    required
                    placeholder="esim. Saunatilan vuokrasopimus 2026"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="px-3 py-2 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 rounded-md text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
            </div>

            <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                    Sopimuksen sisältö
                </label>
                <ContractEditor value={contentHtml} onChange={setContentHtml} />
            </div>
        </form>
    )
}
