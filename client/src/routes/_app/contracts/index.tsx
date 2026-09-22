import { createFileRoute } from "@tanstack/react-router";
import {
	Calendar,
	Edit3,
	FileText,
	Globe,
	Loader2,
	Plus,
	X,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { ContractForm } from "#/components/ContractForm";
import {
	type Contract,
	type CreateContractPayload,
	type UpdateContractPayload,
	getLocalizedText,
	useContracts,
	useCreateContract,
	useUpdateContract,
} from "#/hooks/useContracts";
import { requireAuthGuard } from "#/utils/authGuard";
import { formatDate } from "#/utils/date";

export const Route = createFileRoute("/_app/contracts/")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: ContractsListPage,
});

function ContractCard({
	contract,
	onEdit,
}: {
	contract: Contract;
	onEdit: (contract: Contract) => void;
}) {
	const { t, i18n } = useTranslation();
	const title = getLocalizedText(contract.title, i18n.language);
	const fileName = getLocalizedText(contract.file_name, i18n.language);

	const availableLangs = Object.keys(
		(contract.title as Record<string, string>) || {},
	);

	return (
		<li className="p-4 border-2 dark:border-stone-700 flex flex-col justify-between gap-3 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors min-w-0">
			<div className="flex flex-col gap-1.5">
				<div className="flex items-start justify-between gap-2">
					<h3 className="font-bold text-stone-900 dark:text-stone-100 truncate flex-1 text-base">
						{title}
					</h3>
					<div className="flex items-center gap-1.5 shrink-0">
						{contract.is_global && (
							<Chip className="bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800 gap-1">
								<Globe size={12} />
								<span>{t("yleinen", "Yleinen")}</span>
							</Chip>
						)}
						<Chip
							className={
								contract.is_active
									? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800"
									: "bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-400"
							}
						>
							{contract.is_active
								? t("aktiivinen", "Aktiivinen")
								: t("passiivinen", "Passiivinen")}
						</Chip>
					</div>
				</div>

				<p className="text-xs text-stone-500 dark:text-stone-400 truncate">
					{t("tiedosto", "Tiedosto:")} {fileName}
				</p>
			</div>

			<div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800 gap-2">
				<div className="flex items-center gap-1 text-xs text-stone-500 dark:text-stone-400">
					<Calendar size={14} />
					<span>{formatDate(contract.updated_at)}</span>
				</div>

				<div className="flex items-center gap-2">
					<div className="flex items-center gap-1">
						{availableLangs.map((lang) => (
							<span
								key={lang}
								className="px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase rounded border border-stone-300 dark:border-stone-700 bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300"
							>
								{lang}
							</span>
						))}
					</div>

					<Button
						type="button"
						variant="outline"
						size="sm"
						onClick={() => onEdit(contract)}
						className="gap-1 text-xs px-2 py-1"
					>
						<Edit3 size={14} />
						<span>{t("muokkaa", "Muokkaa")}</span>
					</Button>
				</div>
			</div>
		</li>
	);
}

function ContractModal({
	isOpen,
	onClose,
	contractToEdit,
}: {
	isOpen: boolean;
	onClose: () => void;
	contractToEdit?: Contract | null;
}) {
	const { t } = useTranslation();
	const createContract = useCreateContract();
	const updateContract = useUpdateContract();

	if (!isOpen) return null;

	const isEditing = Boolean(contractToEdit);

	const handleSubmit = async (payload: CreateContractPayload) => {
		if (isEditing && contractToEdit) {
			await updateContract.mutateAsync({
				id: contractToEdit.id,
				payload: payload as UpdateContractPayload,
			});
		} else {
			await createContract.mutateAsync(payload);
		}
		onClose();
	};

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
			<div className="bg-white dark:bg-stone-900 rounded-lg shadow-xl border border-stone-200 dark:border-stone-800 max-w-xl w-full p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
				<div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
					<h2 className="text-lg font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
						<FileText
							size={20}
							className="text-amber-600 dark:text-amber-500"
						/>
						{isEditing
							? t("muokkaaSopimusasiakirjaa", "Muokkaa sopimusasiakirjaa")
							: t("uusiSopimusasiakirja", "Uusi sopimusasiakirja (PDF)")}
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
					>
						<X size={20} />
					</button>
				</div>

				<ContractForm
					initialData={contractToEdit || undefined}
					onSubmit={handleSubmit}
					isSubmitting={createContract.isPending || updateContract.isPending}
					submitLabel={
						isEditing
							? t("tallennaMuutokset", "Tallenna muutokset")
							: t("tallennaAsiakirja", "Tallenna asiakirja")
					}
				/>
			</div>
		</div>
	);
}

function ContractsListPage() {
	const { t } = useTranslation();
	const { data: contracts, isLoading, isError } = useContracts();
	const [isModalOpen, setIsModalOpen] = useState(false);
	const [selectedContract, setSelectedContract] = useState<Contract | null>(
		null,
	);

	const handleOpenCreate = () => {
		setSelectedContract(null);
		setIsModalOpen(true);
	};

	const handleOpenEdit = (contract: Contract) => {
		setSelectedContract(contract);
		setIsModalOpen(true);
	};

	const handleCloseModal = () => {
		setIsModalOpen(false);
		setSelectedContract(null);
	};

	return (
		<div className="flex flex-col gap-4 p-4 max-w-5xl mx-auto flex-1 w-full">
			{/* Header */}
			<div className="flex items-center justify-between gap-4">
				<div className="flex items-center gap-2">
					<FileText className="text-amber-600 dark:text-amber-500" size={24} />
					<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
						{t("sopimuksetJaSaannot", "Sopimukset ja säännöt")}
					</h1>
				</div>

				<Button
					onClick={handleOpenCreate}
					className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
				>
					<Plus size={18} />
					<span>{t("uusiSopimus", "Uusi sopimusasiakirja")}</span>
				</Button>
			</div>

			{/* List View */}
			{isLoading ? (
				<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
					<Loader2 className="animate-spin" size={18} />
					<span>{t("ladataanSopimuksia", "Ladataan sopimuksia...")}</span>
				</div>
			) : isError ? (
				<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
					{t(
						"virheLadattaessaSopimuksia",
						"Virhe ladattaessa sopimusasiakirjoja.",
					)}
				</div>
			) : contracts && contracts.length > 0 ? (
				<ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
					{contracts.map((c) => (
						<ContractCard key={c.id} contract={c} onEdit={handleOpenEdit} />
					))}
				</ul>
			) : (
				<div className="p-8 text-center text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
					{t(
						"eiTallennettujaSopimuksia",
						"Ei tallennettuja sopimusasiakirjoja.",
					)}
				</div>
			)}

			<ContractModal
				isOpen={isModalOpen}
				onClose={handleCloseModal}
				contractToEdit={selectedContract}
			/>
		</div>
	);
}
