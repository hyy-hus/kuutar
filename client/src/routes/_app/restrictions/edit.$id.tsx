import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import {
	RestrictionForm,
	type RestrictionFormValues,
} from "#/components/RestrictionForm";
import { useRestriction, useUpdateRestriction } from "#/hooks/useRestrictions";
import { requireAdminGuard } from "#/utils/authGuard";
import { formatDateTimeLocal } from "#/utils/date";
import { seriesFirstTimes } from "#/utils/series";

export const Route = createFileRoute("/_app/restrictions/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: EditRestrictionPage,
});

function EditRestrictionPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const { data: restrictionWithOcc, isLoading } = useRestriction(id);
	const updateRestriction = useUpdateRestriction();

	if (isLoading) {
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanRajoitusta", "Ladataan rajoitusta...")}
			</p>
		);
	}

	if (!restrictionWithOcc) {
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("rajoitustaEiLytynyt", "Rajoitusta ei löytynyt.")}
			</p>
		);
	}

	const handleSubmit = async (values: RestrictionFormValues) => {
		await updateRestriction.mutateAsync({
			id,
			payload: {
				title: values.title,
				description: values.description || null,
				exempt_group_ids: values.exempt_group_ids,
				rrule: values.rrule ?? null,
				occurrences: values.occurrences.map((occ) => ({
					resource_id: occ.resource_id || null,
					start_time: new Date(occ.start_time).toISOString(),
					end_time: new Date(occ.end_time).toISOString(),
				})),
			},
		});

		navigate({ to: "/restrictions/$id", params: { id } });
	};

	const occurrences = restrictionWithOcc.occurrences || [];
	const firstOccurrence = occurrences[0];
	const firstTimes = firstOccurrence
		? seriesFirstTimes(restrictionWithOcc.rrule, firstOccurrence)
		: null;
	// Global restrictions have a null resource_id and map to an empty selection
	const resourceIds = Array.from(
		new Set(
			occurrences
				.map((occ) => occ.resource_id)
				.filter((rid): rid is string => Boolean(rid)),
		),
	);

	return (
		<FormLayout>
			<PageHeader
				back={
					<BackLink to="/restrictions/$id" params={{ id }}>
						{t("takaisinRajoitukseen", "Takaisin rajoitukseen")}
					</BackLink>
				}
				title={t("muokkaaRajoitusta", "Muokkaa aikarajoitusta")}
			/>
			<RestrictionForm
				defaultValues={{
					title: restrictionWithOcc.title,
					description: restrictionWithOcc.description || "",
					exempt_group_ids: restrictionWithOcc.exempt_group_ids,
					rrule: restrictionWithOcc.rrule,
					resource_ids: resourceIds,
					start_time: firstTimes ? formatDateTimeLocal(firstTimes.start) : "",
					end_time: firstTimes ? formatDateTimeLocal(firstTimes.end) : "",
					occurrences: occurrences.map((occ) => ({
						resource_id: occ.resource_id || null,
						start_time: formatDateTimeLocal(new Date(occ.start_time)),
						end_time: formatDateTimeLocal(new Date(occ.end_time)),
					})),
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateRestriction.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
				onCancel={() => navigate({ to: "/restrictions/$id", params: { id } })}
			/>
		</FormLayout>
	);
}
