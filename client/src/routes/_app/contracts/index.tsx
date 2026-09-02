import { createFileRoute, Link } from '@tanstack/react-router'
import { FileText, Plus, Loader2, Calendar } from 'lucide-react'
import { Button } from '#/components/Button'
import { Chip } from '#/components/Chip'
import { useContracts, type Contract } from '#/hooks/useContracts'
import { readable_uuid } from '#/utils/uuid'
import { formatDate } from '#/utils/date'

export const Route = createFileRoute('/_app/contracts/')({
    component: ContractsListPage,
})

function ContractCard({ contract }: { contract: Contract }) {
    return (
        <li className="p-3 border-2 dark:border-stone-700 flex flex-col gap-2 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors min-w-0">
            <div className="flex items-start justify-between gap-2">
                <h3 className="font-bold text-stone-900 dark:text-stone-100 truncate flex-1">
                    {contract.name}
                </h3>
                <Chip>{readable_uuid(contract.id)}</Chip>
            </div>

            <div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
                <Calendar size={14} />
                <span>Päivitetty: {formatDate(contract.updated_at)}</span>
            </div>

            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-end">
                <Button variant="secondary" size="sm" asChild>
                    <Link to="/contracts/$id" params={{ id: contract.id }} className="gap-1.5 text-xs font-medium">
                        <FileText size={16} />
                        <span>Muokkaa sopimusta</span>
                    </Link>
                </Button>
            </div>
        </li>
    )
}

function ContractsListPage() {
    const { data: contracts, isLoading, isError } = useContracts()

    return (
        <div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto flex-1 w-full">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <FileText className="text-amber-600 dark:text-amber-500" size={24} />
                    <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                        Sopimuspohjat
                    </h1>
                </div>

                <Button asChild className="bg-amber-600 hover:bg-amber-700 text-white gap-2">
                    <Link to="/contracts/create">
                        <Plus size={18} />
                        <span>Uusi sopimuspohja</span>
                    </Link>
                </Button>
            </div>

            {/* List View */}
            {isLoading ? (
                <div className="p-8 flex items-center justify-center gap-2 text-stone-500">
                    <Loader2 className="animate-spin" size={18} />
                    <span>Ladataan sopimuspohjia...</span>
                </div>
            ) : isError ? (
                <div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
                    Virhe ladattaessa sopimuspohjia.
                </div>
            ) : contracts && contracts.length > 0 ? (
                <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    {contracts.map((c) => (
                        <ContractCard key={c.id} contract={c} />
                    ))}
                </ul>
            ) : (
                <div className="p-8 text-center text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
                    Ei tallennettuja sopimuspohjia.
                </div>
            )}
        </div>
    )
}
