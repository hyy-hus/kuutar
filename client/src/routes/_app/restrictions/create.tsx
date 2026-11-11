import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import {
	RestrictionForm,
	type RestrictionFormValues,
} from "#/components/RestrictionForm";
import { useCreateRestriction } from "#/hooks/useRestrictions";
import { requireAdminGuard } from "#/utils/authGuard";
import { formatDateTimeLocal } from "#/utils/date";

export interface CreateRestrictionSearch {
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

export const Route = createFileRoute("/_app/restrictions/create")({
	validateSearch: (
		search: Record<string, unknown>,
	): CreateRestrictionSearch => ({
		start_time:
			typeof search.start_time === "string" ? search.start_time : undefined,
		end_time: typeof search.end_time === "string" ? search.end_time : undefined,
		resource_id:
			typeof search.resource_id === "string" ? search.resource_id : undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateRestrictionPage,
});

function CreateRestrictionPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createRestriction = useCreateRestriction();
	const { start_time, end_time, resource_id } = Route.useSearch();

	const { defaultStart, defaultEnd } = getDefaultSlot();

	const handleSubmit = async (values: RestrictionFormValues) => {
		const created = await createRestriction.mutateAsync({
			title: values.title,
			description: values.description || null,
			exempt_group_ids:
				values.exempt_group_ids.length > 0 ? values.exempt_group_ids : null,
			rrule: values.rrule ?? null,
			occurrences: values.occurrences.map((occ) => ({
				resource_id: occ.resource_id || null,
				start_time: new Date(occ.start_time).toISOString(),
				end_time: new Date(occ.end_time).toISOString(),
			})),
		});

		navigate({ to: "/restrictions/$id", params: { id: created.id } });
	};

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/restrictions">
						{t("takaisinRajoituksiin", "Takaisin rajoituksiin")}
					</BackLink>
				}
				title={t("uusiAikarajoitus", "Uusi aikarajoitus")}
			/>
			<RestrictionForm
				defaultValues={{
					occurrences: [
						{
							resource_id: resource_id || null,
							start_time: start_time || defaultStart,
							end_time: end_time || defaultEnd,
						},
					],
				}}
				onSubmit={handleSubmit}
				isSubmitting={createRestriction.isPending}
				submitLabel={t("luoRajoitus", "Luo aikarajoitus")}
				onCancel={() => navigate({ to: "/restrictions" })}
			/>
		</FormLayout>
	);
}
