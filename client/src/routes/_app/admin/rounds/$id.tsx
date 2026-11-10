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
import { assignSlot, roundPhase } from "#/utils/rounds";
import { RoundPhaseChip } from "./index";

const DASH = " – ";

export const Route = createFileRoute("/_app/admin/rounds/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: RoundPage,
});

type Slot = {
	key: string;
	resource_id: string;
	start_time: string;
	end_time: string;
	applications: RoundApplication[];
};

function groupBySlot(applications: RoundApplication[]): Slot[] {
	const slots = new Map<string, Slot>();
	for (const app of applications) {
		const key = `${app.resource_id}|${new Date(app.start_time).getTime()}`;
		const slot = slots.get(key) ?? {
			key,
			resource_id: app.resource_id,
			start_time: app.start_time,
			end_time: app.end_time,
			applications: [],
		};
		slot.applications.push(app);
		slots.set(key, slot);
	}
	return [...slots.values()].sort(
		(a, b) =>
			a.resource_id.localeCompare(b.resource_id) ||
			new Date(a.start_time).getTime() - new Date(b.start_time).getTime(),
	);
}

function RoundPage() {
	const { id } = Route.useParams();
	const { t } = useTranslation();
	const navigate = useNavigate();
	const { formatDate, formatDateOnly, formatDateRange } = useDateFormatter();

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
	// Slots to allocate: the pending applications, or after completion the granted ones
	const slots = useMemo(
		() =>
			groupBySlot(
				(applications ?? []).filter(
					(a) => a.status === (isCompleted ? "confirmed" : "pending"),
				),
			),
		[applications, isCompleted],
	);
	const allocatedIds = isCompleted
		? all.filter((a) => a.status === "confirmed").map((a) => a.reservation_id)
		: granted;

	if (!round) return <Loader2 className="animate-spin" />;

	const phase = roundPhase(round);
	const canAllocate = phase === "allocating";
	const resourceName = (rid: string) =>
		resources?.find((r) => r.id === rid)?.name ?? rid;
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
			{slots.length === 0 && (
				<p className="text-sm text-stone-500">
					{t("eiHakemuksia", "Ei hakemuksia.")}
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
						disabled={save.isPending}
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

			<ul className="space-y-2">
				{slots.map((slot) => {
					const holder = slot.applications.find((a) =>
						allocatedIds.includes(a.reservation_id),
					);
					return (
						<li
							key={slot.key}
							className="p-3 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900 flex flex-wrap items-center justify-between gap-2"
						>
							<div>
								<div className="font-medium text-sm">
									{resourceName(slot.resource_id)}
								</div>
								<div className="text-xs text-stone-600 dark:text-stone-400">
									{formatDateRange(slot.start_time, slot.end_time)}
								</div>
							</div>
							<select
								aria-label={t("jaonSaaja", "Varausjakson saaja")}
								disabled={!canAllocate}
								value={holder?.reservation_id ?? ""}
								onChange={(e) =>
									setEdited(
										assignSlot(
											granted,
											applications ?? [],
											slot,
											e.target.value || null,
										),
									)
								}
								className="h-8 text-xs rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 px-2"
							>
								<option value="">
									{t("eiKenellekaan", "— Ei kenellekään —")}
								</option>
								{slot.applications.map((a) => (
									<option key={a.reservation_id} value={a.reservation_id}>
										{`${a.user_name ?? a.user_id} (${t("prioriteetti", "prioriteetti")} ${a.priority})`}
									</option>
								))}
							</select>
						</li>
					);
				})}
			</ul>

			<ApplicantList
				applications={all}
				allocatedIds={allocatedIds}
				completed={isCompleted}
				resourceName={resourceName}
			/>

			{canAllocate && (
				<Button
					onClick={finish}
					disabled={complete.isPending || (!saved?.saved && !edited)}
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
	resourceName,
}: {
	applications: RoundApplication[];
	allocatedIds: string[];
	completed: boolean;
	resourceName: (resourceId: string) => string;
}) {
	const { t } = useTranslation();
	const { formatDateRange } = useDateFormatter();

	const applicants = useMemo(() => {
		const byUser = new Map<string, RoundApplication[]>();
		for (const app of applications) {
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
	}, [applications]);

	if (applicants.length === 0) return null;

	return (
		<section className="space-y-2">
			<h2 className="font-bold">{t("hakijat", "Hakijat")}</h2>
			<ul className="space-y-3">
				{applicants.map((apps) => {
					const first = apps[0];
					const got = apps.filter((a) =>
						allocatedIds.includes(a.reservation_id),
					);
					return (
						<li
							key={first.user_id}
							className="p-3 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900 space-y-2"
						>
							<div className="flex flex-wrap items-baseline justify-between gap-2">
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
								<div className="text-xs font-medium">
									{got.length > 0
										? `${t("myonnetty", "Myönnetty")}: ${got
												.map(
													(a) =>
														`${resourceName(a.resource_id)} ${formatDateRange(a.start_time, a.end_time)}`,
												)
												.join(", ")}`
										: completed
											? t("eiMyonnetty", "Ei myönnetty")
											: t("eiVielaMyonnetty", "Ei vielä myönnetty")}
								</div>
							</div>
							<ol className="space-y-2">
								{apps.map((a) => {
									const granted = allocatedIds.includes(a.reservation_id);
									return (
										<li
											key={a.reservation_id}
											className={`pl-3 border-l-4 text-sm space-y-0.5 ${
												granted
													? "border-emerald-600"
													: a.status === "cancelled"
														? "border-stone-300 dark:border-stone-700 opacity-60"
														: "border-stone-400 dark:border-stone-600"
											}`}
										>
											<div className="flex flex-wrap items-center gap-2">
												<span className="font-medium">{`${a.priority}. ${a.title}`}</span>
												<span className="text-xs text-stone-600 dark:text-stone-400">
													{`${resourceName(a.resource_id)}, ${formatDateRange(a.start_time, a.end_time)}`}
												</span>
												{granted && (
													<span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
														{t("myonnetty", "Myönnetty")}
													</span>
												)}
												{!granted && a.status === "cancelled" && (
													<span className="text-[11px] text-stone-500">
														{t("peruttuTaiHylatty", "Peruttu tai ei myönnetty")}
													</span>
												)}
											</div>
											<RichTextContent value={a.description} />
											{a.message_to_admins && (
												<p className="text-xs text-stone-600 dark:text-stone-400 whitespace-pre-line">
													{a.message_to_admins}
												</p>
											)}
										</li>
									);
								})}
							</ol>
						</li>
					);
				})}
			</ul>
		</section>
	);
}
