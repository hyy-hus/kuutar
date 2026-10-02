import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import {
	ReservationForm,
	type ReservationFormValues,
} from "#/components/ReservationForm";
import { useReservation, useUpdateReservation } from "#/hooks/useReservations";
import { requireAuthGuard } from "#/utils/authGuard";
import { formatDateTimeLocal } from "#/utils/date";

export const Route = createFileRoute("/_app/reservations/edit/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: EditReservationPage,
});

function EditReservationPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: reservation, isLoading } = useReservation(id);
	const updateReservation = useUpdateReservation();

	if (isLoading)
		return (
			<div className="p-4">{t("ladataanVarausta", "Ladataan varausta...")}</div>
		);
	if (!reservation)
		return (
			<div className="p-4">
				{t("varaustaEiLytynyt", "Varausta ei löytynyt.")}
			</div>
		);

	const firstOccurrence = reservation.occurrences?.[0];

	// Extract all unique resource IDs across occurrences
	const resourceIds = Array.from(
		new Set(reservation.occurrences?.map((occ) => occ.resource_id) || []),
	);

	const handleSubmit = async (values: ReservationFormValues) => {
		await updateReservation.mutateAsync({
			id: reservation.id,
			payload: {
				title: values.title,
				description: values.description || null,
				status: values.status,
				admin_notes: values.admin_notes || null,
				contact_person: values.contact_person || null,
				contact_email: values.contact_email || null,
				contact_phone: values.contact_phone || null,
				rrule: values.rrule || null,
				occurrences: values.occurrences ?? [],
			},
		});
		navigate({ to: "/reservations/$id", params: { id: reservation.id } });
	};

	return (
		<div className="p-4 space-y-4">
			<BackLink to="/reservations/$id" params={{ id }}>
				{t("takaisinVaraukseen", "Takaisin varaukseen")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("muokkaaVarausta", "Muokkaa varausta")}
			</h1>
			<ReservationForm
				defaultValues={{
					title: reservation.title,
					description: reservation.description ?? "",
					status: reservation.status,
					admin_notes: reservation.admin_notes ?? "",
					contact_person: reservation.contact_person ?? "",
					contact_email: reservation.contact_email ?? "",
					contact_phone: reservation.contact_phone ?? "",
					rrule: reservation.rrule,
					resource_ids: resourceIds,
					start_time: firstOccurrence
						? formatDateTimeLocal(new Date(firstOccurrence.start_time))
						: "",
					end_time: firstOccurrence
						? formatDateTimeLocal(new Date(firstOccurrence.end_time))
						: "",
					occurrences: reservation.occurrences,
				}}
				onSubmit={handleSubmit}
				isSubmitting={updateReservation.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
				isCreate={false}
			/>
		</div>
	);
}
