import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Callout } from "#/components/Callout";
import { FormLayout } from "#/components/FormLayout";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import {
	ReservationForm,
	type ReservationFormValues,
} from "#/components/ReservationForm";
import { getDefaultContact, useAuth } from "#/hooks/useAuth";
import { useReservation, useUpdateReservation } from "#/hooks/useReservations";
import { requireAuthGuard } from "#/utils/authGuard";
import { formatDateTimeLocal } from "#/utils/date";
import {
	compactLocalizedRichText,
	toLocalizedRichText,
} from "#/utils/richText";
import { seriesFirstTimes } from "#/utils/series";

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
	const { user } = useAuth();

	if (isLoading)
		return (
			<PageContainer width="narrow">
				<p className="text-sm text-stone-600 dark:text-stone-400">
					{t("ladataanVarausta", "Ladataan varausta...")}
				</p>
			</PageContainer>
		);
	if (!reservation)
		return (
			<PageContainer width="narrow">
				<Callout variant="danger">
					{t("varaustaEiLytynyt", "Varausta ei löytynyt.")}
				</Callout>
			</PageContainer>
		);

	const firstOccurrence = reservation.occurrences?.[0];
	const firstTimes = firstOccurrence
		? seriesFirstTimes(reservation.rrule, firstOccurrence)
		: null;

	// Extract all unique resource IDs across occurrences
	const resourceIds = Array.from(
		new Set(reservation.occurrences?.map((occ) => occ.resource_id) || []),
	);

	// Fall back to the owner's saved defaults when the reservation has no contact info
	const fallbackContact =
		user && user.id === reservation.user_id
			? getDefaultContact(user)
			: getDefaultContact(null);

	const handleSubmit = async (values: ReservationFormValues) => {
		await updateReservation.mutateAsync({
			id: reservation.id,
			payload: {
				title: values.title,
				// An empty document clears the description; omitting it would keep the old one
				description: compactLocalizedRichText(values.description ?? {}) ?? {},
				message_to_admins: values.message_to_admins ?? "",
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
		<FormLayout width="guided">
			<PageHeader
				back={
					<BackLink to="/reservations/$id" params={{ id }}>
						{t("takaisinVaraukseen", "Takaisin varaukseen")}
					</BackLink>
				}
				title={t("muokkaaVarausta", "Muokkaa varausta")}
			/>
			<ReservationForm
				reservationId={reservation.id}
				defaultValues={{
					title: reservation.title,
					description: toLocalizedRichText(reservation.description),
					message_to_admins: reservation.message_to_admins ?? "",
					status: reservation.status,
					admin_notes: reservation.admin_notes ?? "",
					contact_person:
						reservation.contact_person || fallbackContact.contact_person,
					contact_email:
						reservation.contact_email || fallbackContact.contact_email,
					contact_phone:
						reservation.contact_phone || fallbackContact.contact_phone,
					rrule: reservation.rrule,
					resource_ids: resourceIds,
					start_time: firstTimes ? formatDateTimeLocal(firstTimes.start) : "",
					end_time: firstTimes ? formatDateTimeLocal(firstTimes.end) : "",
					occurrences: reservation.occurrences,
				}}
				onSubmit={handleSubmit}
				onCancel={() =>
					navigate({ to: "/reservations/$id", params: { id: reservation.id } })
				}
				isSubmitting={updateReservation.isPending}
				submitLabel={t("tallennaMuutokset", "Tallenna muutokset")}
				isCreate={false}
			/>
		</FormLayout>
	);
}
