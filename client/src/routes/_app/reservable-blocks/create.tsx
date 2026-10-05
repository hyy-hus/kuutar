import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import {
	ReservableBlockForm,
	type ReservableBlockFormValues,
} from "#/components/ReservableBlockForm";
import { useCreateReservableBlock } from "#/hooks/useReservableBlocks";
import { requireAdminGuard } from "#/utils/authGuard";
import { formatDateTimeLocal } from "#/utils/date";

export interface CreateReservableBlockSearch {
	start_time?: string;
	end_time?: string;
	resource_id?: string;
}

const getDefaultSlot = () => {
	const start = new Date();
	start.setMinutes(0, 0, 0);

	const end = new Date(start);
	end.setHours(start.getHours() + 2);

	return {
		defaultStart: formatDateTimeLocal(start),
		defaultEnd: formatDateTimeLocal(end),
	};
};

export const Route = createFileRoute("/_app/reservable-blocks/create")({
	validateSearch: (
		search: Record<string, unknown>,
	): CreateReservableBlockSearch => ({
		start_time:
			typeof search.start_time === "string" ? search.start_time : undefined,
		end_time: typeof search.end_time === "string" ? search.end_time : undefined,
		resource_id:
			typeof search.resource_id === "string" ? search.resource_id : undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateReservableBlockPage,
});

function CreateReservableBlockPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createBlock = useCreateReservableBlock();
	const { start_time, end_time, resource_id } = Route.useSearch();

	const { defaultStart, defaultEnd } = getDefaultSlot();

	const handleSubmit = async (values: ReservableBlockFormValues) => {
		const created = await createBlock.mutateAsync({
			title: values.title,
			description: values.description || null,
			rrule: values.rrule ?? null,
			occurrences: values.occurrences.map((occ) => ({
				resource_id: occ.resource_id,
				start_time: new Date(occ.start_time).toISOString(),
				end_time: new Date(occ.end_time).toISOString(),
			})),
		});

		navigate({ to: "/reservable-blocks/$id", params: { id: created.id } });
	};

	return (
		<div className="max-w-xl mx-auto p-2 sm:p-4 space-y-4 pb-12">
			<BackLink to="/reservable-blocks">
				{t("takaisinVarausjaksoihin", "Takaisin varausjaksoihin")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("uusiVarausjakso", "Uusi varausjakso")}
			</h1>
			<ReservableBlockForm
				defaultValues={{
					resource_ids: resource_id ? [resource_id] : [],
					start_time: start_time || defaultStart,
					end_time: end_time || defaultEnd,
				}}
				onSubmit={handleSubmit}
				isSubmitting={createBlock.isPending}
				submitLabel={t("luoVarausjakso", "Luo varausjakso")}
			/>
		</div>
	);
}
