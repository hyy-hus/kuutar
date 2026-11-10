// src/routes/_app/reservations/create.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
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
	const { formatDate } = useDateFormatter();
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
		<div className="max-w-xl mx-auto p-2 sm:p-4 space-y-4 pb-12">
			<BackLink to="/reservations">
				{t("takaisinVarauksiin", "Takaisin varauksiin")}
			</BackLink>
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("uusiVaraus", "Uusi varaus")}
			</h1>
			{shownRounds.map((round) => (
				<p
					key={round.id}
					className="text-sm p-3 rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800"
				>
					{roundPhase(round) === "open"
						? t(
								"kierrosIlmoitusPaattyy",
								'Varauskierros "{{name}}" on käynnissä ja haku päättyy {{end}}. Varaus resurssille tehdään hakemuksena, ja se vahvistetaan vasta kierroksen päätyttyä.',
								{
									name: round.name,
									end: formatDate(round.applications_close_at),
								},
							)
						: t(
								"kierrosIlmoitusAlkaa",
								'Varauskierros "{{name}}" alkaa {{start}} ja haku päättyy {{end}}. Resurssia voi varata vain kierroksen kautta.',
								{
									name: round.name,
									start: formatDate(round.applications_open_at),
									end: formatDate(round.applications_close_at),
								},
							)}{" "}
					<Link
						to="/reservations/rounds/$id"
						params={{ id: round.id }}
						className="underline font-medium"
					>
						{t("omatHakemukset", "Omat hakemukset")}
					</Link>
				</p>
			))}
			<ReservationForm
				defaultValues={{
					...getDefaultContact(user),
					start_time: start_time || defaultStart,
					end_time: end_time || defaultEnd,
					resource_ids,
				}}
				onSubmit={handleSubmit}
				isSubmitting={createReservation.isPending}
				submitLabel={t("luoVaraus", "Luo varaus")}
				isCreate={true}
			/>
		</div>
	);
}
