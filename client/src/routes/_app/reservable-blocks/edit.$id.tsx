import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
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
import { seriesFirstTimes } from "#/utils/series";

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
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanVarausjaksoa", "Ladataan varausjaksoa...")}
			</p>
		);
	}

	if (!block) {
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("varausjaksoaEiLytynyt", "Varausjaksoa ei löytynyt.")}
			</p>
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
	const firstTimes = firstOccurrence
		? seriesFirstTimes(block.rrule, firstOccurrence)
		: null;
	const resourceIds = Array.from(
		new Set(block.occurrences.map((occ) => occ.resource_id)),
	);

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/reservable-blocks/$id" params={{ id }}>
						{t("takaisinVarausjaksoon", "Takaisin varausjaksoon")}
					</BackLink>
				}
				title={t("muokkaaVarausjaksoa", "Muokkaa varausjaksoa")}
			/>
			<ReservableBlockForm
				defaultValues={{
					title: block.title,
					description: block.description || "",
					rrule: block.rrule,
					resource_ids: resourceIds,
					start_time: firstTimes ? formatDateTimeLocal(firstTimes.start) : "",
					end_time: firstTimes ? formatDateTimeLocal(firstTimes.end) : "",
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateBlock.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
				onCancel={() =>
					navigate({ to: "/reservable-blocks/$id", params: { id } })
				}
			/>
		</FormLayout>
	);
}
