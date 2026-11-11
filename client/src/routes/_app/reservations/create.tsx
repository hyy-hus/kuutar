// src/routes/_app/reservations/create.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { FormLayout } from "#/components/FormLayout";
import { PageHeader } from "#/components/PageHeader";
import {
	ReservationForm,
	type ReservationFormValues,
} from "#/components/ReservationForm";
import { getDefaultContact, useAuth } from "#/hooks/useAuth";
import { useCreateReservation } from "#/hooks/useReservations";
import { useOpenRounds } from "#/hooks/useRounds";
import { requireAuthGuard } from "#/utils/authGuard";
import { formatDateTimeLocal, useDateFormatter } from "#/utils/date";
import { compactLocalizedRichText } from "#/utils/richText";
import { roundPhase } from "#/utils/rounds";

export interface CreateReservationSearch {
	start_time?: string;
	end_time?: string;
	resource_ids?: string[];
}

// Generates fallback start/end times spanning the current hour
const getDefaultSlot = () => {
	const start = new Date();
	start.setMinutes(0, 0, 0);

	const end = new Date(start);
	end.setHours(start.getHours() + 1);

	return {
		defaultStart: formatDateTimeLocal(start),
		defaultEnd: formatDateTimeLocal(end),
	};
};

export const Route = createFileRoute("/_app/reservations/create")({
	validateSearch: (
		search: Record<string, unknown>,
	): CreateReservationSearch => ({
		start_time:
			typeof search.start_time === "string" ? search.start_time : undefined,
		end_time: typeof search.end_time === "string" ? search.end_time : undefined,
		resource_ids: Array.isArray(search.resource_ids)
			? (search.resource_ids as string[])
			: typeof search.resource_ids === "string"
				? search.resource_ids.split(",").filter(Boolean)
				: undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: CreateReservationPage,
});

function CreateReservationPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createReservation = useCreateReservation();
	const { user } = useAuth();
	const { start_time, end_time, resource_ids } = Route.useSearch();
	const { data: openRounds } = useOpenRounds();
	const activeRounds =
		openRounds?.filter((round) => roundPhase(round) === "open") ?? [];
	const { formatDateTime } = useDateFormatter();
	// Rounds that cover the preselected resources; with none preselected, all of them
	const shownRounds = (openRounds ?? []).filter(
		(round) =>
			!resource_ids?.length ||
			round.resource_ids.some((id) => resource_ids.includes(id)),
	);

	// Calculate fallback times for current hour if query params aren't provided
	const { defaultStart, defaultEnd } = getDefaultSlot();

	const handleSubmit = async (values: ReservationFormValues) => {
		// A block on a resource in an open round is an application in that round
		const occurrence = values.occurrences?.[0];
		const round = occurrence
			? activeRounds.find(
					(r) =>
						r.resource_ids.includes(occurrence.resource_id) &&
						new Date(occurrence.start_time) >= new Date(r.period_start) &&
						new Date(occurrence.end_time) <= new Date(r.period_end),
				)
			: undefined;

		const created = await createReservation.mutateAsync({
			user_id: values.user_id || null,
			title: values.title,
			description: compactLocalizedRichText(values.description ?? {}),
			message_to_admins: values.message_to_admins || null,
			status: values.status,
			admin_notes: values.admin_notes || null,
			contact_person: values.contact_person || null,
			contact_email: values.contact_email || null,
			contact_phone: values.contact_phone || null,
			rrule: values.rrule || null,
			occurrences: values.occurrences ?? [],
			round_id: round?.id ?? null,
		});

		if (round) {
			navigate({ to: "/reservations/rounds/$id", params: { id: round.id } });
			return;
		}
		navigate({ to: "/reservations/$id", params: { id: created.id } });
	};

	return (
		<FormLayout width="guided">
			<PageHeader
				back={
					<BackLink to="/reservations">
						{t("takaisinOmiinVarauksiin", "Takaisin omiin varauksiin")}
					</BackLink>
				}
				title={t("uusiVaraus", "Uusi varaus")}
			/>
			{shownRounds.map((round) => (
				<Callout
					key={round.id}
					variant="info"
					action={
						<Button variant="outline" size="sm" asChild>
							<Link to="/reservations/rounds/$id" params={{ id: round.id }}>
								{t("omatHakemukset", "Omat hakemukset")}
							</Link>
						</Button>
					}
				>
					{roundPhase(round) === "open"
						? t(
								"kierrosIlmoitusPaattyy",
								'Varauskierros "{{name}}" on käynnissä ja haku päättyy {{end}}. Varaus resurssille tehdään hakemuksena, ja se vahvistetaan vasta kierroksen päätyttyä.',
								{
									name: round.name,
									end: formatDateTime(round.applications_close_at),
								},
							)
						: t(
								"kierrosIlmoitusAlkaa",
								'Varauskierros "{{name}}" alkaa {{start}} ja haku päättyy {{end}}. Resurssia voi varata vain kierroksen kautta.',
								{
									name: round.name,
									start: formatDateTime(round.applications_open_at),
									end: formatDateTime(round.applications_close_at),
								},
							)}
				</Callout>
			))}
			<ReservationForm
				defaultValues={{
					...getDefaultContact(user),
					start_time: start_time || defaultStart,
					end_time: end_time || defaultEnd,
					resource_ids,
				}}
				onSubmit={handleSubmit}
				onCancel={() => navigate({ to: "/reservations" })}
				isSubmitting={createReservation.isPending}
				submitLabel={t("luoVaraus", "Luo varaus")}
				isCreate={true}
			/>
		</FormLayout>
	);
}
