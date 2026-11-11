import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FileText, Globe, Loader2, Plus } from "lucide-react";
import { Dialog } from "radix-ui";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { Chip } from "#/components/Chip";
import { ContractForm } from "#/components/ContractForm";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { LOCALE_ORDER } from "#/components/LocaleTabs";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { StatusChip } from "#/components/StatusChip";
import {
	type Contract,
	type CreateContractPayload,
	getLocalizedText,
	type UpdateContractPayload,
	useContracts,
	useCreateContract,
	useUpdateContract,
} from "#/hooks/useContracts";
import { requireAdminGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";

interface ContractsSearch {
	/** Contract id being edited (the edit dialog is part of the URL, so cards can be plain links) */
	edit?: string;
	/** Opens the create dialog */
	create?: boolean;
}

export const Route = createFileRoute("/_app/contracts/")({
	validateSearch: (search: Record<string, unknown>): ContractsSearch => ({
		edit: typeof search.edit === "string" ? search.edit : undefined,
		create:
			search.create === true || search.create === "true" ? true : undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: ContractsListPage,
});

function ContractCard({ contract }: { contract: Contract }) {
	const { t, i18n } = useTranslation();
	const { formatDateOnly } = useDateFormatter();
	const title = getLocalizedText(contract.title, i18n.language);
	const fileName = getLocalizedText(contract.file_name, i18n.language);

	const titleLangs = Object.keys(
		(contract.title as Record<string, string>) || {},
	);
	// FI, SV, EN first, any extra language codes after them
	const availableLangs = [
		...LOCALE_ORDER.filter((l) => titleLangs.includes(l)),
		...titleLangs.filter(
			(l) => !(LOCALE_ORDER as readonly string[]).includes(l),
		),
	];

	return (
		<EntityCard
			to="/contracts"
			className="h-full"
			search={{ edit: contract.id }}
			icon={FileText}
			title={title}
			meta={`${fileName} · ${t("muokattuPvm", "Muokattu {{date}}", {
				date: formatDateOnly(contract.updated_at),
			})}`}
			badges={
				<>
					{contract.is_global && (
						<StatusChip icon={Globe}>{t("yleinen", "Yleinen")}</StatusChip>
					)}
					{!contract.is_active && (
						<StatusChip>{t("passiivinen", "Passiivinen")}</StatusChip>
					)}
					{availableLangs.map((lang) => (
						<Chip key={lang}>{lang.toUpperCase()}</Chip>
					))}
				</>
			}
		/>
	);
}

function ContractDialog({
	contractToEdit,
	isCreating,
	onClose,
}: {
	contractToEdit?: Contract | null;
	isCreating: boolean;
	onClose: () => void;
}) {
	const { t } = useTranslation();
	const createContract = useCreateContract();
	const updateContract = useUpdateContract();

	const isOpen = isCreating || Boolean(contractToEdit);
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
		<Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs" />
				<Dialog.Content
					aria-describedby={undefined}
					className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-md border border-stone-300 bg-stone-50 p-5 shadow-xl focus:outline-none dark:border-stone-700 dark:bg-stone-900"
				>
					<Dialog.Title className="text-lg font-semibold text-stone-900 dark:text-stone-100">
						{isEditing
							? t("muokkaaSopimusasiakirjaa", "Muokkaa sopimusasiakirjaa")
							: t("uusiSopimusasiakirja", "Uusi sopimusasiakirja (PDF)")}
					</Dialog.Title>

					<ContractForm
						key={contractToEdit?.id ?? "new"}
						initialData={contractToEdit || undefined}
						onSubmit={handleSubmit}
						onCancel={onClose}
						isSubmitting={createContract.isPending || updateContract.isPending}
						submitLabel={
							isEditing
								? t("tallennaMuutokset", "Tallenna muutokset")
								: t("tallennaAsiakirja", "Tallenna asiakirja")
						}
					/>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}

function ContractsListPage() {
	const { t } = useTranslation();
	const { data: contracts, isLoading, isError } = useContracts();
	const { edit, create } = Route.useSearch();
	const navigate = useNavigate({ from: Route.fullPath });

	const selectedContract = edit
		? (contracts?.find((c) => c.id === edit) ?? null)
		: null;

	const closeDialog = () => navigate({ search: {}, replace: true });

	return (
		<PageContainer>
			<PageHeader
				title={t("sopimuksetJaSaannot", "Sopimukset ja säännöt")}
				subtitle={
					contracts
						? t("sopimuksiaMaara", "{{count}} sopimusasiakirjaa", {
								count: contracts.length,
							})
						: undefined
				}
				actions={
					<Button onClick={() => navigate({ search: { create: true } })}>
						<Plus size={16} aria-hidden="true" />
						{t("uusiSopimus", "Uusi sopimusasiakirja")}
					</Button>
				}
			/>

			{isLoading ? (
				<div className="flex items-center justify-center gap-2 p-8 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} />
					<span>{t("ladataanSopimuksia", "Ladataan sopimuksia...")}</span>
				</div>
			) : isError ? (
				<Callout variant="danger">
					{t(
						"virheLadattaessaSopimuksia",
						"Virhe ladattaessa sopimusasiakirjoja.",
					)}
				</Callout>
			) : contracts && contracts.length > 0 ? (
				<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{contracts.map((c) => (
						<li key={c.id} className="flex min-w-0 flex-col">
							<ContractCard contract={c} />
						</li>
					))}
				</ul>
			) : (
				<EmptyState
					icon={FileText}
					title={t(
						"eiTallennettujaSopimuksia",
						"Ei tallennettuja sopimusasiakirjoja.",
					)}
				/>
			)}

			<ContractDialog
				isCreating={Boolean(create)}
				contractToEdit={selectedContract}
				onClose={closeDialog}
			/>
		</PageContainer>
	);
}
