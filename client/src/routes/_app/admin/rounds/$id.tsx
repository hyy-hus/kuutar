import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Check, Dices, Loader2, Save } from "lucide-react";
import { HoverCard } from "radix-ui";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DetailLayout } from "#/components/DetailLayout";
import { EmptyState } from "#/components/EmptyState";
import { FilterBar } from "#/components/FilterBar";
import { RichTextContent } from "#/components/RichTextContent";
import { RoundPhaseChip } from "#/components/RoundPhaseChip";
import { StatusChip } from "#/components/StatusChip";
import { useResources } from "#/hooks/useResorces";
import {
	type RoundApplication,
	useCompleteRound,
	useDeleteRound,
	useProposeAllocation,
	useRound,
	useRoundApplications,
	useSaveAllocation,
	useSavedAllocation,
	useUpdateRound,
} from "#/hooks/useRounds";
import { requireAdminGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import {
	competingApplications,
	findConflicts,
	roundPhase,
	type SlotConflict,
	selectApplication,
} from "#/utils/rounds";

const DASH = " – ";

export const Route = createFileRoute("/_app/admin/rounds/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: RoundPage,
});

function RoundPage() {
	const { id } = Route.useParams();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { formatRange, formatDateOnly } = useDateFormatter();

	const { data: round } = useRound(id);
	const { data: applications } = useRoundApplications(id);
	const { data: saved } = useSavedAllocation(id);
	const { data: resources } = useResources();
	const propose = useProposeAllocation(id);
	const save = useSaveAllocation(id);
	const complete = useCompleteRound(id);
	const deleteRound = useDeleteRound();
	const updateRound = useUpdateRound();

	// null until the admin edits; then it overrides the saved draft
	const [edited, setEdited] = useState<string[] | null>(null);
	const [seed, setSeed] = useState<number | null>(null);
	const [onlyConflicts, setOnlyConflicts] = useState(false);
	const granted = edited ?? saved?.reservation_ids ?? [];

	const all = applications ?? [];
	const pendingApps = all.filter((a) => a.status === "pending");
	const isCompleted = round?.status === "completed";
	const allocatedIds = isCompleted
		? all.filter((a) => a.status === "confirmed").map((a) => a.reservation_id)
		: granted;

	if (!round) return <Loader2 className="animate-spin" />;

	const phase = roundPhase(round);
	const canAllocate = phase === "allocating";
	const resourceName = (rid: string) =>
		resources?.find((r) => r.id === rid)?.name ?? rid;
	const conflicts = findConflicts(granted, pendingApps);
	const grantedCount = granted.length;
	const deniedCount = pendingApps.length - grantedCount;

	const randomize = async () => {
		const proposal = await propose.mutateAsync(undefined);
		setSeed(proposal.seed);
		setEdited(proposal.reservation_ids);
	};

	const finish = async () => {
		const message = t(
			"vahvistaKierroksenPaattaminen",
			"Päätetäänkö kierros? {{confirmed}} hakemusta vahvistetaan ja {{denied}} peruutetaan, ja hakijoille lähetetään sähköposti. Tätä ei voi perua.",
			{ confirmed: grantedCount, denied: deniedCount },
		);
		if (!window.confirm(message)) return;
		if (edited) await save.mutateAsync(edited);
		await complete.mutateAsync();
	};

	const actions = phase !== "completed" && (
		<>
			{canAllocate && (
				<Button
					onClick={finish}
					disabled={
						complete.isPending ||
						conflicts.size > 0 ||
						(!saved?.saved && !edited)
					}
				>
					{t("paataKierros", "Päätä kierros ja lähetä päätökset")}
				</Button>
			)}
			{phase === "open" && (
				<Button
					variant="outline"
					disabled={updateRound.isPending}
					onClick={() => {
						if (
							window.confirm(
								t(
									"vahvistaHakuaikaPaattyy",
									"Päätetäänkö haku nyt? Uusia hakemuksia ei voi enää jättää, ja jako voidaan tehdä.",
								),
							)
						) {
							updateRound.mutate({
								id,
								payload: {
									applications_close_at: new Date().toISOString(),
								},
							});
						}
					}}
				>
					{t("paataHakuNyt", "Päätä haku nyt")}
				</Button>
			)}
			<Button variant="outline" asChild>
				<Link to="/admin/rounds/edit/$id" params={{ id }}>
					{t("muokkaaKierrosta", "Muokkaa kierrosta")}
				</Link>
			</Button>
		</>
	);

	const canDelete = phase !== "completed" && all.length === 0;
	const applicantCount = new Set(
		all
			.filter((a) => isCompleted || a.status === "pending")
			.map((a) => a.user_id),
	).size;

	return (
		<DetailLayout
			width="wide"
			back={
				<BackLink to="/admin/rounds">
					{t("takaisinKierroksiin", "Takaisin varauskierroksiin")}
				</BackLink>
			}
			title={round.name}
			status={<RoundPhaseChip round={round} />}
			actions={actions}
			technical={{ id: round.id, createdAt: round.created_at }}
			dangerZone={
				canDelete && (
					<Button
						variant="danger-outline"
						onClick={async () => {
							if (
								!window.confirm(
									t(
										"vahvistaPoistaKierros",
										"Poistetaanko kierros? Tätä ei voi perua.",
									),
								)
							)
								return;
							await deleteRound.mutateAsync(id);
							await navigate({ to: "/admin/rounds" });
						}}
					>
						{t("poistaKierros", "Poista kierros")}
					</Button>
				)
			}
		>
			{round.description && <p className="text-sm">{round.description}</p>}

			<dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-stone-300 bg-stone-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-4 dark:border-stone-700 dark:bg-stone-900">
				<Meta label={t("hakuaika", "Hakuaika")}>
					{formatRange(round.applications_open_at, round.applications_close_at)}
				</Meta>
				<Meta label={t("kierroksenAjanjakso", "Varattava ajanjakso")}>
					{`${formatDateOnly(round.period_start)}${DASH}${formatDateOnly(round.period_end)}`}
				</Meta>
				<Meta label={t("hakemuksiaEnintaan", "Hakemuksia enintään")}>
					{round.max_pending_per_resource}
				</Meta>
				<Meta label={t("resurssit", "Resurssit")}>
					{round.resource_ids.map(resourceName).join(", ")}
				</Meta>
			</dl>

			{phase !== "allocating" && phase !== "completed" && (
				<Callout variant="info">
					{t(
						"jakoVasta",
						"Jako voidaan tehdä, kun haku on päättynyt. Voit päättää haun etukäteen painikkeella.",
					)}
				</Callout>
			)}

			<section className="space-y-3">
				<div className="space-y-1">
					<h2 className="text-lg font-semibold">
						{`${t("kierroksenHakemukset", "Hakemukset")} (${all.length})`}
					</h2>
					{applicantCount > 0 && (
						<p className="text-sm text-stone-600 dark:text-stone-400">
							{t(
								"hakijoitaJaRistiriitoja",
								"{{applicants}} hakijaa, {{conflicts}} ristiriitaa",
								{ applicants: applicantCount, conflicts: conflicts.size },
							)}
						</p>
					)}
				</div>
				{all.length === 0 && (
					<EmptyState title={t("eiHakemuksia", "Ei hakemuksia.")} />
				)}
				{conflicts.size > 0 && canAllocate && (
					<Callout variant="danger">
						{t(
							"jaossaPaallekkaisyyksia",
							"Jaossa on {{count}} päällekkäisyyttä. Korjaa ne ennen tallennusta.",
							{ count: conflicts.size },
						)}
					</Callout>
				)}

				{canAllocate && (
					<FilterBar
						actions={
							<label className="flex cursor-pointer items-center gap-2 text-sm">
								<input
									type="checkbox"
									className="size-4 accent-purple-600"
									checked={onlyConflicts}
									onChange={(e) => setOnlyConflicts(e.target.checked)}
								/>
								{t("vainRistiriidat", "Vain ristiriidat")}
							</label>
						}
					>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={randomize}
							disabled={propose.isPending}
						>
							<Dices size={14} />
							{t("arvoJako", "Arvo jako")}
						</Button>
						<Button
							variant="outline"
							size="sm"
							className="gap-1.5"
							onClick={() => save.mutate(granted)}
							disabled={save.isPending || conflicts.size > 0}
						>
							<Save size={14} />
							{t("tallennaJako", "Tallenna jako")}
						</Button>
						{seed !== null && (
							<span className="text-xs text-stone-600 dark:text-stone-400">
								{`${t("arvonnanSiemen", "Arvonnan siemen")}: ${seed}`}
							</span>
						)}
						{saved?.saved && !edited && (
							<span className="text-xs text-stone-600 dark:text-stone-400">
								{t("jakoTallennettu", "Jako on tallennettu.")}
							</span>
						)}
					</FilterBar>
				)}

				<ApplicantList
					applications={all}
					allocatedIds={allocatedIds}
					completed={isCompleted}
					editable={canAllocate}
					conflicts={conflicts}
					onlyConflicts={onlyConflicts}
					resourceName={resourceName}
					onSelect={(userId, resourceId, reservationId) =>
						setEdited(
							selectApplication(
								granted,
								pendingApps,
								userId,
								resourceId,
								reservationId,
							),
						)
					}
				/>
			</section>

			{(complete.isError || save.isError || propose.isError) && (
				<Callout variant="danger">
					{(complete.error ?? save.error ?? propose.error)?.message}
				</Callout>
			)}
			{complete.isSuccess && (
				<Callout variant="success">
					{t(
						"kierrosPaatetty",
						"Kierros päätettiin: {{confirmed}} vahvistettu, {{cancelled}} peruttu.",
						{
							confirmed: complete.data.confirmed_count,
							cancelled: complete.data.cancelled_count,
						},
					)}
				</Callout>
			)}
		</DetailLayout>
	);
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-0 space-y-0.5">
			<dt className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400">
				{label}
			</dt>
			<dd className="tabular-nums">{children}</dd>
		</div>
	);
}

function ApplicantList({
	applications,
	allocatedIds,
	completed,
	editable,
	conflicts,
	onlyConflicts,
	resourceName,
	onSelect,
}: {
	applications: RoundApplication[];
	allocatedIds: string[];
	completed: boolean;
	editable: boolean;
	conflicts: Map<string, SlotConflict>;
	onlyConflicts: boolean;
	resourceName: (resourceId: string) => string;
	onSelect: (
		userId: string,
		resourceId: string,
		reservationId: string | null,
	) => void;
}) {
	const { t } = useTranslation();
	const { formatRange } = useDateFormatter();

	// Withdrawn applications can't be granted; after completion everything stays visible
	const shown = applications.filter((a) => completed || a.status === "pending");
	const nameOf = (reservationId: string) => {
		const app = applications.find((a) => a.reservation_id === reservationId);
		return app?.user_name ?? app?.user_id ?? "";
	};

	const applicants = useMemo(() => {
		const byUser = new Map<string, RoundApplication[]>();
		for (const app of shown) {
			byUser.set(app.user_id, [...(byUser.get(app.user_id) ?? []), app]);
		}
		return [...byUser.values()]
			.map((apps) =>
				[...apps].sort(
					(a, b) =>
						a.resource_id.localeCompare(b.resource_id) ||
						a.priority - b.priority,
				),
			)
			.sort((a, b) =>
				(a[0].user_name ?? "").localeCompare(b[0].user_name ?? ""),
			);
	}, [shown]);

	if (applicants.length === 0) return null;

	const visible = onlyConflicts
		? applicants.filter((apps) =>
				apps.some((a) => conflicts.has(a.reservation_id)),
			)
		: applicants;

	if (visible.length === 0) {
		return <EmptyState title={t("eiRistiriitoja", "Ei ristiriitoja.")} />;
	}

	return (
		<ul className="space-y-3">
			{visible.map((apps) => {
				const first = apps[0];
				const resourceIds = [...new Set(apps.map((a) => a.resource_id))];
				const hasConflict = apps.some((a) => conflicts.has(a.reservation_id));
				return (
					<li
						key={first.user_id}
						className={`space-y-3 rounded-md border bg-stone-50 p-4 dark:bg-stone-900 ${
							hasConflict
								? "border-red-500"
								: "border-stone-300 dark:border-stone-700"
						}`}
					>
						<div className="flex flex-wrap items-start justify-between gap-2">
							<div>
								<h3 className="text-base font-bold">
									{first.user_name ?? first.user_id}
								</h3>
								<div className="text-xs text-stone-600 dark:text-stone-400">
									{[
										first.user_email,
										first.contact_person,
										first.contact_email,
										first.contact_phone,
									]
										.filter(Boolean)
										.join(" · ")}
								</div>
							</div>
							{hasConflict && (
								<StatusChip variant="danger" icon={AlertTriangle}>
									{t("ristiriita", "Ristiriita")}
								</StatusChip>
							)}
						</div>

						{resourceIds.map((resourceId) => {
							const options = apps.filter((a) => a.resource_id === resourceId);
							const chosen = options.find((a) =>
								allocatedIds.includes(a.reservation_id),
							);
							const groupName = `alloc-${first.user_id}-${resourceId}`;
							return (
								<fieldset
									key={resourceId}
									disabled={!editable}
									className="space-y-1.5"
								>
									<legend className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400">
										{resourceName(resourceId)}
									</legend>
									{options.map((a) => {
										const conflict = conflicts.get(a.reservation_id);
										const rivals = competingApplications(
											a,
											applications,
										).filter((o) => completed || o.status === "pending");
										const heldByOther = rivals.filter((o) =>
											allocatedIds.includes(o.reservation_id),
										);
										const isChosen =
											chosen?.reservation_id === a.reservation_id;
										return (
											<div
												key={a.reservation_id}
												className={`space-y-1 rounded-md border p-2 text-sm ${
													conflict
														? "border-red-500 bg-red-50 dark:bg-red-950/40"
														: isChosen
															? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
															: "border-stone-300 dark:border-stone-700"
												} ${a.status === "cancelled" && !isChosen ? "opacity-60" : ""}`}
											>
												<label className="flex min-h-8 cursor-pointer flex-wrap items-center gap-x-3 gap-y-1">
													<input
														type="radio"
														className="size-5 shrink-0 accent-purple-600"
														name={groupName}
														checked={isChosen}
														onChange={() =>
															onSelect(
																a.user_id,
																a.resource_id,
																a.reservation_id,
															)
														}
													/>
													<span className="font-medium tabular-nums">
														{`${a.priority}. ${formatRange(a.start_time, a.end_time)}`}
													</span>
													<ApplicationHoverCard application={a} />
													{isChosen && completed && (
														<StatusChip variant="success" icon={Check}>
															{t("myonnetty", "Myönnetty")}
														</StatusChip>
													)}
													{rivals.length > 0 && (
														<StatusChip variant="warning">
															{t("kilpailtuJakso", "Haettu myös: {{names}}", {
																names: rivals
																	.map((o) => nameOf(o.reservation_id))
																	.join(", "),
															})}
														</StatusChip>
													)}
													{!completed &&
														!isChosen &&
														heldByOther.length > 0 && (
															<StatusChip variant="neutral">
																{t("jaettuToiselle", "Jaettu: {{names}}", {
																	names: heldByOther
																		.map((o) => nameOf(o.reservation_id))
																		.join(", "),
																})}
															</StatusChip>
														)}
													{!completed && a.externally_taken && (
														<StatusChip variant="danger">
															{t(
																"jaksoJoVarattu",
																"Jakso on jo varattu muulla varauksella",
															)}
														</StatusChip>
													)}
												</label>
												{conflict && conflict.sharedWith.length > 0 && (
													<p className="text-xs font-semibold text-red-700 dark:text-red-300">
														{t(
															"paallekkaisyys",
															"Päällekkäisyys: sama jakso on myönnetty myös: {{names}}",
															{
																names: conflict.sharedWith
																	.map(nameOf)
																	.join(", "),
															},
														)}
													</p>
												)}
											</div>
										);
									})}
									<label className="flex min-h-8 cursor-pointer items-center gap-3 px-2 text-sm">
										<input
											type="radio"
											className="size-5 shrink-0 accent-purple-600"
											name={groupName}
											checked={!chosen}
											onChange={() => onSelect(first.user_id, resourceId, null)}
										/>
										{completed
											? t("eiMyonnetty", "Ei myönnetty")
											: t("eiMyonnetaMitaan", "Ei myönnetä mitään")}
									</label>
								</fieldset>
							);
						})}
					</li>
				);
			})}
		</ul>
	);
}

/** The reservation's title; hovering or focusing it shows everything the applicant wrote */
function ApplicationHoverCard({
	application,
}: {
	application: RoundApplication;
}) {
	const { t } = useTranslation();
	return (
		<HoverCard.Root openDelay={150} closeDelay={100}>
			<HoverCard.Trigger asChild>
				<button
					type="button"
					className="text-xs text-stone-600 dark:text-stone-400 underline decoration-dotted cursor-help"
				>
					{application.title}
				</button>
			</HoverCard.Trigger>
			<HoverCard.Portal>
				<HoverCard.Content
					side="bottom"
					align="start"
					sideOffset={6}
					className="z-50 w-80 max-w-[90vw] p-3 space-y-2 text-sm rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 shadow-lg"
				>
					<div className="font-bold">{application.title}</div>
					<section>
						<h3 className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400">
							{t("kuvaus", "Kuvaus")}
						</h3>
						<RichTextContent
							value={application.description}
							fallback={
								<p className="text-xs text-stone-600 dark:text-stone-400">
									{t("eiKuvaustaSaatavilla", "Ei kuvausta saatavilla.")}
								</p>
							}
						/>
					</section>
					<section>
						<h3 className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400">
							{t("viestiYllapitajille", "Viesti ylläpitäjille")}
						</h3>
						<p className="text-xs whitespace-pre-line">
							{application.message_to_admins || "—"}
						</p>
					</section>
					<section>
						<h3 className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400">
							{t("yllpitjnMuistiinpanot", "Ylläpitäjän muistiinpanot")}
						</h3>
						<p className="text-xs whitespace-pre-line">
							{application.admin_notes || "—"}
						</p>
					</section>
					<HoverCard.Arrow className="fill-white dark:fill-stone-950" />
				</HoverCard.Content>
			</HoverCard.Portal>
		</HoverCard.Root>
	);
}
