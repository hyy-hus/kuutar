import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
	RestrictionForm,
	type RestrictionFormValues,
} from "#/components/RestrictionForm";
import { useRestriction, useUpdateRestriction } from "#/hooks/useRestrictions";
import { requireAuthGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/restrictions/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: EditRestrictionPage,
});

const formatDateTimeLocal = (isoString: string) => {
	const d = new Date(isoString);
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function EditRestrictionPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const { data: restrictionWithOcc, isLoading } = useRestriction(id);
	const updateRestriction = useUpdateRestriction();

	if (isLoading) {
		return (
			<div className="p-4 text-xs text-stone-500">
				{t("ladataanRajoitusta", "Ladataan rajoitusta...")}
			</div>
		);
	}

	if (!restrictionWithOcc) {
		return (
			<div className="p-4 text-xs text-stone-500">
				{t("rajoitustaEiLytynyt", "Rajoitusta ei löytynyt.")}
			</div>
		);
	}

	const handleSubmit = async (values: RestrictionFormValues) => {
		await updateRestriction.mutateAsync({
			id,
			payload: {
				title: values.title,
				description: values.description || null,
				exempt_group_ids: values.exempt_group_ids,
				occurrences: values.occurrences.map((occ) => ({
					resource_id: occ.resource_id || null,
					start_time: new Date(occ.start_time).toISOString(),
					end_time: new Date(occ.end_time).toISOString(),
				})),
			},
		});

		navigate({ to: "/restrictions/$id", params: { id } });
	};

	return (
		<div className="max-w-xl mx-auto p-4 space-y-4">
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaRajoitusta", "Muokkaa aikarajoitusta")}
			</h1>
			<RestrictionForm
				defaultValues={{
					title: restrictionWithOcc.title,
					description: restrictionWithOcc.description || "",
					exempt_group_ids: restrictionWithOcc.exempt_group_ids,
					occurrences: (restrictionWithOcc.occurrences || []).map((occ) => ({
						resource_id: occ.resource_id || null,
						start_time: formatDateTimeLocal(occ.start_time),
						end_time: formatDateTimeLocal(occ.end_time),
					})),
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateRestriction.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
			/>
		</div>
	);
}
