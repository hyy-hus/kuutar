import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import {
	ReservableBlockForm,
	type ReservableBlockFormValues,
} from "#/components/ReservableBlockForm";
import {
	useReservableBlock,
	useUpdateReservableBlock,
} from "#/hooks/useReservableBlocks";
import { requireAdminGuard } from "#/utils/authGuard";
import { formatDateTimeLocal } from "#/utils/date";

export const Route = createFileRoute("/_app/reservable-blocks/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EditReservableBlockPage,
});

function EditReservableBlockPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const { data: block, isLoading } = useReservableBlock(id);
	const updateBlock = useUpdateReservableBlock();

	if (isLoading) {
		return (
			<div className="p-4 text-xs text-stone-500">
				{t("ladataanVarausjaksoa", "Ladataan varausjaksoa...")}
			</div>
		);
	}

	if (!block) {
		return (
			<div className="p-4 text-xs text-stone-500">
				{t("varausjaksoaEiLytynyt", "Varausjaksoa ei löytynyt.")}
			</div>
		);
	}

	const handleSubmit = async (values: ReservableBlockFormValues) => {
		await updateBlock.mutateAsync({
			id,
			payload: {
				title: values.title,
				description: values.description || null,
				rrule: values.rrule ?? null,
				occurrences: values.occurrences.map((occ) => ({
					resource_id: occ.resource_id,
					start_time: new Date(occ.start_time).toISOString(),
					end_time: new Date(occ.end_time).toISOString(),
				})),
			},
		});

		navigate({ to: "/reservable-blocks/$id", params: { id } });
	};

	const firstOccurrence = block.occurrences[0];
	const resourceIds = Array.from(
		new Set(block.occurrences.map((occ) => occ.resource_id)),
	);

	return (
		<div className="max-w-xl mx-auto p-4 space-y-4">
			<BackLink to="/reservable-blocks/$id" params={{ id }}>
				{t("takaisinVarausjaksoon", "Takaisin varausjaksoon")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaVarausjaksoa", "Muokkaa varausjaksoa")}
			</h1>
			<ReservableBlockForm
				defaultValues={{
					title: block.title,
					description: block.description || "",
					rrule: block.rrule,
					resource_ids: resourceIds,
					start_time: firstOccurrence
						? formatDateTimeLocal(new Date(firstOccurrence.start_time))
						: "",
					end_time: firstOccurrence
						? formatDateTimeLocal(new Date(firstOccurrence.end_time))
						: "",
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateBlock.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</div>
	);
}
