import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	Clock,
	Edit,
	Mail,
	Phone,
	Shield,
	Trash2,
	User as UserIcon,
	X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { CancelReservationDialog } from "#/components/CancelReservationDialog";
import { Chip } from "#/components/Chip";
import { OutlookBadge } from "#/components/OutlookBadge";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { useDeleteReservation, useReservation } from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useDateFormatter } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/reservations/$id")({
	component: ViewReservationPage,
});

function ViewReservationPage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { isAdmin } = useIsAdmin();
	const { user } = useAuth();

	const { data: reservation, isLoading, isError } = useReservation(id);
	const { data: resources } = useResources();
	const deleteReservation = useDeleteReservation();

	if (isLoading) {
		return (
			<div className="p-8 text-xs text-stone-500">
				{t("ladataanVarausta", "Ladataan varausta...")}
			</div>
		);
	}

	if (isError || !reservation || !reservation.title) {
		return (
			<div className="p-8 text-center text-stone-500 space-y-2">
				<p>{t("varaustaEiLytynyt", "Varausta ei löytynyt.")}</p>
				<Link
					to="/calendar"
					className="text-purple-600 hover:underline text-xs"
				>
					{t("palaaKalenteriin", "Palaa kalenteriin")}
				</Link>
			</div>
		);
	}

	// Contact details are only returned by the server to admins and the owner
	const canSeeContact = isAdmin || (!!user && user.id === reservation.user_id);
	const isOutlook = reservation.source === "outlook";
	// Outlook is the source of truth for imported reservations
	const canEdit =
		!isOutlook && (isAdmin || (!!user && user.id === reservation.user_id));
	const isCancelled = reservation.status === "cancelled";
	const canCancel = canEdit && !isCancelled;
	const occurrences = reservation.occurrences || [];
	const resourceMap = new Map(resources?.map((r) => [r.id, r.name]));

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

	return (
		<div className="max-w-2xl mx-auto p-4 space-y-6">
			{/* Top Nav */}
			<div className="flex items-center justify-between">
				<Link
					to="/calendar"
					className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
				>
					<ArrowLeft size={14} />
					<span>{t("palaaKalenteriin", "Palaa kalenteriin")}</span>
				</Link>

				<div className="flex items-center gap-2">
					{canEdit && (
						<Link to="/reservations/edit/$id" params={{ id }}>
							<Button variant="outline" size="sm" className="gap-1 text-xs">
								<Edit size={14} />
								<span>{t("muokkaa", "Muokkaa")}</span>
							</Button>
						</Link>
					)}
					{canCancel && (
						<CancelReservationDialog
							reservationId={id}
							reservationTitle={reservation.title}
							trigger={
								<Button
									variant="outline"
									size="sm"
									className="gap-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
								>
									<X size={14} />
									<span>{t("peruVaraus", "Peru varaus")}</span>
								</Button>
							}
						/>
					)}
					{!isOutlook && isAdmin && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleDelete}
							disabled={deleteReservation.isPending}
							className="gap-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
						>
							<Trash2 size={14} />
							<span>{t("poista", "Poista")}</span>
						</Button>
					)}
				</div>
			</div>

			{/* Main Card */}
			<div className="p-5 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900 space-y-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
							{reservation.title}
							{isOutlook && <OutlookBadge />}
						</h1>
						{reservation.user_name && (
							<p className="text-xs text-stone-600 dark:text-stone-400 flex items-center gap-1 mt-0.5">
								<UserIcon size={12} className="text-purple-600 shrink-0" />
								<span>
									{t("varaaja", "Varaaja")}
									{": "}
									{reservation.user_name}
								</span>
								{isAdmin && reservation.user_email && (
									<span className="text-stone-400 font-mono">
										{"("}
										{reservation.user_email}
										{")"}
									</span>
								)}
							</p>
						)}
						{reservation.description && (
							<p className="text-xs text-stone-600 dark:text-stone-400 mt-2">
								{reservation.description}
							</p>
						)}
					</div>
					<Chip>{readable_uuid(reservation.id)}</Chip>
				</div>

				{isCancelled && (
					<div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded space-y-1 text-xs text-rose-900 dark:text-rose-200">
						<p className="font-semibold">
							{t("varausPeruttu", "Varaus on peruttu")}
							{reservation.cancelled_at && (
								<span className="font-normal">
									{" · "}
									{formatDate(reservation.cancelled_at)}
								</span>
							)}
						</p>
						{reservation.cancel_reason && (
							<p>
								{t("peruutuksenSyy", "Peruutuksen syy")}
								{": "}
								{reservation.cancel_reason}
							</p>
						)}
					</div>
				)}

				{/* Contact Details Card (admin or owner) */}
				{canSeeContact &&
					(reservation.contact_person ||
						reservation.contact_email ||
						reservation.contact_phone ||
						(isAdmin && reservation.admin_notes)) && (
						<div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900 rounded space-y-2 text-xs">
							<div className="flex items-center gap-1 font-semibold text-purple-900 dark:text-purple-300">
								<Shield size={14} />
								<span>{t("yhteystiedot", "Yhteystiedot")}</span>
							</div>

							{reservation.contact_person && (
								<p className="text-stone-800 dark:text-stone-200">
									<strong>
										{t("yhteyshenkilo", "Yhteyshenkilö")}
										{":"}
									</strong>{" "}
									{reservation.contact_person}
								</p>
							)}

							<div className="flex flex-wrap gap-3 text-stone-700 dark:text-stone-300">
								{reservation.contact_email && (
									<span className="flex items-center gap-1">
										<Mail size={12} />
										<a
											href={`mailto:${reservation.contact_email}`}
											className="hover:underline"
										>
											{reservation.contact_email}
										</a>
									</span>
								)}
								{reservation.contact_phone && (
									<span className="flex items-center gap-1">
										<Phone size={12} />
										<a
											href={`tel:${reservation.contact_phone}`}
											className="hover:underline"
										>
											{reservation.contact_phone}
										</a>
									</span>
								)}
							</div>

							{isAdmin && reservation.admin_notes && (
								<p className="italic text-stone-600 dark:text-stone-400 pt-1 border-t border-purple-200 dark:border-purple-900">
									<strong>
										{t("muistiinpanot", "Muistiinpanot")}
										{":"}
									</strong>{" "}
									{reservation.admin_notes}
								</p>
							)}
						</div>
					)}

				{/* Occurrences List */}
				<div className="space-y-2 pt-2 border-t border-stone-200 dark:border-stone-800">
					<span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
						{t("varatutAjat", "Varatut ajat ja resurssit ({{count}})", {
							count: occurrences.length,
						})}
					</span>

					<div className="space-y-1.5 max-h-60 overflow-y-auto">
						{occurrences.map((occ) => (
							<div
								key={occ.id}
								className="flex items-center justify-between gap-2 p-2 bg-stone-100 dark:bg-stone-800/60 rounded border border-stone-200 dark:border-stone-800 text-xs font-mono"
							>
								<div className="flex items-center gap-1.5 text-stone-800 dark:text-stone-200">
									<Clock size={14} className="text-purple-600 shrink-0" />
									<span>
										{formatDate(occ.start_time)}
										{" →"} {formatDate(occ.end_time)}
									</span>
								</div>
								<span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
									{resourceMap.get(occ.resource_id) || occ.resource_id}
								</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
