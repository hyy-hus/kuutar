import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, Mail, Pencil, Phone, RotateCcw, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { CancelReservationDialog } from "#/components/CancelReservationDialog";
import { DetachOccurrenceButton } from "#/components/DetachOccurrenceButton";
import { DetailLayout } from "#/components/DetailLayout";
import { OccurrenceList } from "#/components/OccurrenceList";
import { OutlookBadge } from "#/components/OutlookBadge";
import { PageContainer } from "#/components/PageContainer";
import { ReservationStatusChip } from "#/components/ReservationStatusChip";
import { RichTextContent } from "#/components/RichTextContent";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import {
	useDeleteReservation,
	useReservation,
	useSplitReservation,
	useUpdateReservation,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useDateFormatter } from "#/utils/date";
import { canSplitOccurrence, planSplit } from "#/utils/series";

export const Route = createFileRoute("/_app/reservations/$id")({
	component: ViewReservationPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold text-stone-900 dark:text-stone-100">
				{title}
			</h2>
			{children}
		</section>
	);
}

function ViewReservationPage() {
	const { t } = useTranslation();
	const { formatDateTime } = useDateFormatter();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { isAdmin } = useIsAdmin();
	const { user } = useAuth();

	const { data: reservation, isLoading, isError } = useReservation(id);
	const { data: resources } = useResources();
	const deleteReservation = useDeleteReservation();
	const splitReservation = useSplitReservation();
	const updateReservation = useUpdateReservation();

	if (isLoading) {
		return (
			<PageContainer>
				<p className="text-sm text-stone-600 dark:text-stone-400">
					{t("ladataanVarausta", "Ladataan varausta...")}
				</p>
			</PageContainer>
		);
	}

	if (isError || !reservation || !reservation.title) {
		return (
			<PageContainer width="default">
				<BackLink to="/reservations">
					{t("takaisinOmiinVarauksiin", "Takaisin omiin varauksiin")}
				</BackLink>
				<Callout variant="danger">
					{t("varaustaEiLytynyt", "Varausta ei löytynyt.")}
				</Callout>
			</PageContainer>
		);
	}

	// Contact details are only returned by the server to admins and the owner
	const canSeeContact = isAdmin || (!!user && user.id === reservation.user_id);
	const isOutlook = reservation.source === "outlook";
	// Outlook is the source of truth for imported reservations
	const canEdit =
		!isOutlook && (isAdmin || (!!user && user.id === reservation.user_id));
	const isCancelled = reservation.status === "cancelled";
	const isPending = reservation.status === "pending";
	// Round applications are decided by the round's allocation, never approved one by one
	const isRoundApplication = !!reservation.round_id;
	const canDecide = isAdmin && isPending && !isOutlook && !isRoundApplication;
	const canCancel = canEdit && !isCancelled;
	const occurrences = reservation.occurrences || [];
	const resourceNames = new Map(resources?.map((r) => [r.id, r.name]));

	const rrule = reservation.rrule;
	const handleDetach = async (occurrence: (typeof occurrences)[number]) => {
		if (!rrule) return;
		const created = await splitReservation.mutateAsync({
			id: reservation.id,
			...planSplit(rrule, occurrences, occurrence),
		});
		navigate({ to: "/reservations/edit/$id", params: { id: created.id } });
	};

	const handleDelete = async () => {
		if (
			confirm(
				t(
					"vahvistaVarauksenPoisto",
					"Haluatko varmasti poistaa tämän varauksen pysyvästi? Jos varaus vain peruuntuu, käytä Peru varaus -toimintoa.",
				),
			)
		) {
			await deleteReservation.mutateAsync(id);
			navigate({ to: "/calendar" });
		}
	};

	const hasContact =
		reservation.contact_person ||
		reservation.contact_email ||
		reservation.contact_phone ||
		(isAdmin && reservation.admin_notes);

	const actions = (
		<>
			{canDecide && (
				<Button
					disabled={updateReservation.isPending}
					onClick={() =>
						updateReservation.mutate({
							id,
							payload: { status: "confirmed" },
						})
					}
				>
					<Check size={16} aria-hidden="true" />
					{t("hyvksy", "Hyväksy")}
				</Button>
			)}
			{canEdit && (
				<Button variant="outline" asChild>
					<Link to="/reservations/edit/$id" params={{ id }}>
						<Pencil size={16} aria-hidden="true" />
						{t("muokkaa", "Muokkaa")}
					</Link>
				</Button>
			)}
			{canCancel && (
				<CancelReservationDialog
					reservationId={id}
					reservationTitle={reservation.title}
					trigger={
						<Button variant="outline">
							<X size={16} aria-hidden="true" />
							{canDecide ? t("hylk", "Hylkää") : t("peruVaraus", "Peru varaus")}
						</Button>
					}
				/>
			)}
			{isAdmin && isCancelled && !isOutlook && (
				<Button
					variant="outline"
					disabled={updateReservation.isPending}
					onClick={() =>
						updateReservation.mutate({ id, payload: { status: "pending" } })
					}
				>
					<RotateCcw size={16} aria-hidden="true" />
					{t("palautaOdottavaksi", "Palauta odottavaksi")}
				</Button>
			)}
		</>
	);

	return (
		<DetailLayout
			title={reservation.title}
			status={
				<>
					<ReservationStatusChip status={reservation.status} />
					{isOutlook && <OutlookBadge />}
				</>
			}
			subtitle={
				reservation.user_name
					? `${t("varaaja", "Varaaja")}: ${reservation.user_name}${
							isAdmin && reservation.user_email
								? ` (${reservation.user_email})`
								: ""
						}`
					: undefined
			}
			back={
				<BackLink to="/reservations">
					{t("takaisinOmiinVarauksiin", "Takaisin omiin varauksiin")}
				</BackLink>
			}
			actions={actions}
			dangerZone={
				!isOutlook && isAdmin ? (
					<Button
						variant="danger-outline"
						onClick={handleDelete}
						disabled={deleteReservation.isPending}
					>
						<Trash2 size={16} aria-hidden="true" />
						{t("poista", "Poista")}
					</Button>
				) : undefined
			}
			technical={{
				id: reservation.id,
				createdAt: reservation.created_at,
				updatedAt: reservation.updated_at,
			}}
		>
			{isCancelled && (
				<Callout
					variant="danger"
					title={
						<>
							{t("varausPeruttu", "Varaus on peruttu")}
							{reservation.cancelled_at && (
								<span className="font-normal tabular-nums">
									{" · "}
									{formatDateTime(reservation.cancelled_at)}
								</span>
							)}
						</>
					}
				>
					{reservation.cancel_reason && (
						<>
							{t("peruutuksenSyy", "Peruutuksen syy")}
							{": "}
							{reservation.cancel_reason}
						</>
					)}
				</Callout>
			)}

			<RichTextContent
				value={reservation.description}
				className="text-sm text-stone-700 dark:text-stone-300"
			/>

			<Section
				title={t("varatutAjat", "Varatut ajat ja resurssit ({{count}})", {
					count: occurrences.length,
				})}
			>
				<OccurrenceList
					occurrences={occurrences}
					resourceNames={resourceNames}
					renderAction={(occ) =>
						canEdit && canSplitOccurrence(rrule, occurrences, occ) ? (
							<DetachOccurrenceButton
								onDetach={() => handleDetach(occ)}
								disabled={splitReservation.isPending}
							/>
						) : null
					}
				/>
			</Section>

			{/* Private message from the reserver (admin or owner) */}
			{canSeeContact && reservation.message_to_admins && (
				<Section title={t("viestiYllapidolle", "Viesti ylläpidolle")}>
					<p className="whitespace-pre-line text-sm text-stone-700 dark:text-stone-300">
						{reservation.message_to_admins}
					</p>
				</Section>
			)}

			{canSeeContact && hasContact && (
				<Section title={t("yhteystiedot", "Yhteystiedot")}>
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						{reservation.contact_person && (
							<>
								<dt className="text-stone-600 dark:text-stone-400">
									{t("yhteyshenkilo", "Yhteyshenkilö")}
								</dt>
								<dd>{reservation.contact_person}</dd>
							</>
						)}
						{reservation.contact_email && (
							<>
								<dt className="text-stone-600 dark:text-stone-400">
									<Mail size={14} className="inline" aria-hidden="true" />{" "}
									{t("yhteysSähköposti", "Sähköposti")}
								</dt>
								<dd>
									<a
										href={`mailto:${reservation.contact_email}`}
										className="text-purple-700 hover:underline dark:text-purple-400"
									>
										{reservation.contact_email}
									</a>
								</dd>
							</>
						)}
						{reservation.contact_phone && (
							<>
								<dt className="text-stone-600 dark:text-stone-400">
									<Phone size={14} className="inline" aria-hidden="true" />{" "}
									{t("puhelinnumero", "Puhelinnumero")}
								</dt>
								<dd>
									<a
										href={`tel:${reservation.contact_phone}`}
										className="text-purple-700 hover:underline dark:text-purple-400"
									>
										{reservation.contact_phone}
									</a>
								</dd>
							</>
						)}
						{isAdmin && reservation.admin_notes && (
							<>
								<dt className="text-stone-600 dark:text-stone-400">
									{t("muistiinpanot", "Muistiinpanot")}
								</dt>
								<dd className="whitespace-pre-line">
									{reservation.admin_notes}
								</dd>
							</>
						)}
					</dl>
				</Section>
			)}
		</DetailLayout>
	);
}
