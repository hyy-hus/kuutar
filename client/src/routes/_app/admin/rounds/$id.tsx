import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Dices, Loader2, Save } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { RichTextContent } from "#/components/RichTextContent";
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
import { RoundPhaseChip } from "./index";

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
	const { formatDate, formatDateOnly } = useDateFormatter();

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

	return (
		<div className="space-y-4">
			<BackLink to="/admin/rounds">
				{t("takaisinKierroksiin", "Takaisin varauskierroksiin")}
			</BackLink>
			<div className="flex items-center gap-2">
				<h1 className="text-xl font-bold">{round.name}</h1>
				<RoundPhaseChip round={round} />
			</div>
			{phase !== "completed" && (
				<div className="flex flex-wrap gap-2">
					<Button variant="secondary" size="sm" asChild>
						<Link to="/admin/rounds/edit/$id" params={{ id }}>
							{t("muokkaaKierrosta", "Muokkaa kierrosta")}
						</Link>
					</Button>
					{phase === "open" && (
						<Button
							variant="secondary"
							size="sm"
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
				</div>
			)}
			{round.description && <p className="text-sm">{round.description}</p>}
			{phase !== "allocating" && phase !== "completed" && (
				<p className="text-xs text-stone-500">
					{t(
						"jakoVasta",
						"Jako voidaan tehdä, kun haku on päättynyt. Voit päättää haun etukäteen painikkeella.",
					)}
				</p>
			)}
			<dl className="text-sm grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
				<dt className="font-medium">{t("hakuaika", "Hakuaika")}</dt>
				<dd>
					{formatDate(round.applications_open_at)}
					{DASH}
					{formatDate(round.applications_close_at)}
				</dd>
				<dt className="font-medium">
					{t("kierroksenAjanjakso", "Varattava ajanjakso")}
				</dt>
				<dd>
					{formatDateOnly(round.period_start)}
					{DASH}
					{formatDateOnly(round.period_end)}
				</dd>
				<dt className="font-medium">
					{t("hakemuksiaEnintaan", "Hakemuksia enintään")}
				</dt>
				<dd>{round.max_pending_per_resource}</dd>
			</dl>

			<h2 className="font-bold">
				{`${t("kierroksenHakemukset", "Hakemukset")} (${all.length})`}
			</h2>
			{all.length === 0 && (
				<p className="text-sm text-stone-500">
					{t("eiHakemuksia", "Ei hakemuksia.")}
				</p>
			)}
			{conflicts.size > 0 && canAllocate && (
				<p
					role="alert"
					className="text-sm font-medium p-2 rounded-md border border-red-500 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200"
				>
					{t(
						"jaossaPaallekkaisyyksia",
						"Jaossa on {{count}} päällekkäisyyttä. Korjaa ne ennen tallennusta.",
						{ count: conflicts.size },
					)}
				</p>
			)}

			{canAllocate && (
				<div className="flex flex-wrap items-center gap-2">
					<Button
						variant="secondary"
						size="sm"
						className="gap-1.5"
						onClick={randomize}
						disabled={propose.isPending}
					>
						<Dices size={14} />
						{t("arvoJako", "Arvo jako")}
					</Button>
					<Button
						size="sm"
						className="gap-1.5"
						onClick={() => save.mutate(granted)}
						disabled={save.isPending || conflicts.size > 0}
					>
						<Save size={14} />
						{t("tallennaJako", "Tallenna jako")}
					</Button>
					{seed !== null && (
						<span className="text-xs text-stone-500">
							{`${t("arvonnanSiemen", "Arvonnan siemen")}: ${seed}`}
						</span>
					)}
					{saved?.saved && !edited && (
						<span className="text-xs text-stone-500">
							{t("jakoTallennettu", "Jako on tallennettu.")}
						</span>
					)}
				</div>
			)}

			<ApplicantList
				applications={all}
				allocatedIds={allocatedIds}
				completed={isCompleted}
				editable={canAllocate}
				conflicts={conflicts}
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
			{(complete.isError || save.isError || propose.isError) && (
				<p role="alert" className="text-sm text-red-600">
					{(complete.error ?? save.error ?? propose.error)?.message}
				</p>
			)}
			{complete.isSuccess && (
				<p className="text-sm text-green-700">
					{t(
						"kierrosPaatetty",
						"Kierros päätettiin: {{confirmed}} vahvistettu, {{cancelled}} peruttu.",
						{
							confirmed: complete.data.confirmed_count,
							cancelled: complete.data.cancelled_count,
						},
					)}
				</p>
			)}

			{phase !== "completed" && all.length === 0 && (
				<Button
					variant="secondary"
					size="sm"
					onClick={async () => {
						await deleteRound.mutateAsync(id);
						await navigate({ to: "/admin/rounds" });
					}}
				>
					{t("poistaKierros", "Poista kierros")}
				</Button>
			)}
		</div>
	);
}

function ApplicantList({
	applications,
	allocatedIds,
	completed,
	editable,
	conflicts,
	resourceName,
	onSelect,
}: {
	applications: RoundApplication[];
	allocatedIds: string[];
	completed: boolean;
	editable: boolean;
	conflicts: Map<string, SlotConflict>;
	resourceName: (resourceId: string) => string;
	onSelect: (
		userId: string,
		resourceId: string,
		reservationId: string | null,
	) => void;
}) {
	const { t } = useTranslation();
	const { formatDateRange } = useDateFormatter();

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

	return (
		<section className="space-y-2">
			<h2 className="font-bold">{t("hakijat", "Hakijat")}</h2>
			<ul className="space-y-3">
				{applicants.map((apps) => {
					const first = apps[0];
					const resourceIds = [...new Set(apps.map((a) => a.resource_id))];
					const hasConflict = apps.some((a) => conflicts.has(a.reservation_id));
					return (
						<li
							key={first.user_id}
							className={`p-3 border-2 rounded-md bg-stone-50 dark:bg-stone-900 space-y-3 ${
								hasConflict
									? "border-red-500"
									: "border-stone-800 dark:border-stone-700"
							}`}
						>
							<div>
								<div className="font-bold text-sm">
									{first.user_name ?? first.user_id}
								</div>
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

							{resourceIds.map((resourceId) => {
								const options = apps.filter(
									(a) => a.resource_id === resourceId,
								);
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
										<legend className="text-xs font-bold uppercase tracking-wide text-stone-600 dark:text-stone-400">
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
													className={`p-2 rounded-md border text-sm space-y-1 ${
														conflict
															? "border-red-500 bg-red-50 dark:bg-red-950/40"
															: isChosen
																? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30"
																: "border-stone-300 dark:border-stone-700"
													} ${a.status === "cancelled" && !isChosen ? "opacity-60" : ""}`}
												>
													<label className="flex flex-wrap items-center gap-2 cursor-pointer">
														<input
															type="radio"
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
														<span className="font-medium">
															{`${a.priority}. ${formatDateRange(a.start_time, a.end_time)}`}
														</span>
														<span className="text-xs text-stone-600 dark:text-stone-400">
															{a.title}
														</span>
														{isChosen && completed && (
															<span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
																{t("myonnetty", "Myönnetty")}
															</span>
														)}
														{rivals.length > 0 && (
															<span className="text-[11px] px-1.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300">
																{t("kilpailtuJakso", "Haettu myös: {{names}}", {
																	names: rivals
																		.map((o) => nameOf(o.reservation_id))
																		.join(", "),
																})}
															</span>
														)}
														{!completed &&
															!isChosen &&
															heldByOther.length > 0 && (
																<span className="text-[11px] px-1.5 rounded bg-stone-200 dark:bg-stone-800">
																	{t("jaettuToiselle", "Jaettu: {{names}}", {
																		names: heldByOther
																			.map((o) => nameOf(o.reservation_id))
																			.join(", "),
																	})}
																</span>
															)}
														{!completed && a.externally_taken && (
															<span className="text-[11px] px-1.5 rounded bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300">
																{t(
																	"jaksoJoVarattu",
																	"Jakso on jo varattu muulla varauksella",
																)}
															</span>
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
													<RichTextContent value={a.description} />
													{a.message_to_admins && (
														<p className="text-xs text-stone-600 dark:text-stone-400 whitespace-pre-line">
															{a.message_to_admins}
														</p>
													)}
												</div>
											);
										})}
										<label className="flex items-center gap-2 text-xs cursor-pointer px-2">
											<input
												type="radio"
												name={groupName}
												checked={!chosen}
												onChange={() =>
													onSelect(first.user_id, resourceId, null)
												}
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
		</section>
	);
}
