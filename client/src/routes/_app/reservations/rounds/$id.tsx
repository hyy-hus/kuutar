import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DetailLayout } from "#/components/DetailLayout";
import { EmptyState } from "#/components/EmptyState";
import { RoundPhaseChip } from "#/components/RoundPhaseChip";
import {
	type ReservationWithOccurrences,
	useCancelReservation,
	useMyReservations,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useRound, useSetPriorities } from "#/hooks/useRounds";
import { requireAuthGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import { moveItem, remainingApplications, roundPhase } from "#/utils/rounds";

export const Route = createFileRoute("/_app/reservations/rounds/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: RoundApplicationsPage,
});

const MAX_RANGE_MS = 364 * 24 * 60 * 60 * 1000;

function RoundApplicationsPage() {
	const { id } = Route.useParams();
	const { t } = useTranslation();
	const { formatDateTime, formatDateOnly, formatRange } = useDateFormatter();
	const { data: round } = useRound(id);
	const { data: resources } = useResources();
	const setPriorities = useSetPriorities(id);
	const cancel = useCancelReservation();

	const range = useMemo(() => {
		if (!round) return null;
		const start = new Date(round.period_start);
		const end = new Date(
			Math.min(
				new Date(round.period_end).getTime(),
				start.getTime() + MAX_RANGE_MS,
			),
		);
		return { startDate: start.toISOString(), endDate: end.toISOString() };
	}, [round]);

	const { data: mine } = useMyReservations(
		{ ...(range ?? { startDate: "", endDate: "" }), roundId: id },
		{ enabled: Boolean(range) },
	);

	if (!round) return <Loader2 className="animate-spin" />;

	const isOpen = roundPhase(round) === "open";
	const applications = (mine ?? []).filter((r) => r.status !== "cancelled");
	const byResource = new Map<string, ReservationWithOccurrences[]>();
	for (const app of applications) {
		const rid = app.occurrences[0]?.resource_id;
		if (!rid) continue;
		byResource.set(rid, [...(byResource.get(rid) ?? []), app]);
	}
	for (const list of byResource.values()) {
		list.sort((a, b) => (a.round_priority ?? 0) - (b.round_priority ?? 0));
	}

	const move = (resourceId: string, index: number, delta: -1 | 1) => {
		const list = byResource.get(resourceId) ?? [];
		const ids = moveItem(
			list.map((r) => r.id),
			index,
			delta,
		);
		setPriorities.mutate({ resource_id: resourceId, reservation_ids: ids });
	};

	const resourceName = (rid: string) =>
		resources?.find((r) => r.id === rid)?.name ?? rid;

	return (
		<DetailLayout
			back={
				<BackLink to="/reservations">
					{t("takaisinVarauksiin", "Takaisin varauksiin")}
				</BackLink>
			}
			title={round.name}
			status={<RoundPhaseChip round={round} />}
			actions={
				isOpen && (
					<Button asChild>
						<Link
							to="/reservations/create"
							search={{ resource_ids: round.resource_ids }}
						>
							{t("haeVarausjaksoa", "Hae varausjaksoa")}
						</Link>
					</Button>
				)
			}
		>
			{round.description && <p className="text-sm">{round.description}</p>}

			{isOpen ? (
				<Callout
					variant="info"
					title={t("kierrosOhjeOtsikko", "Näin haku toimii")}
				>
					{t(
						"kierrosOhje",
						"Voit hakea resurssia kohden enintään {{max}} varausjaksoa. Järjestä hakemuksesi mieluisuusjärjestykseen: ylin on toivotuin. Päätökset lähetetään sähköpostilla kierroksen päätyttyä.",
						{ max: round.max_pending_per_resource },
					)}
				</Callout>
			) : (
				<Callout variant="info">
					{t(
						"kierrosEiAvoinna",
						"Haku ei ole käynnissä, joten hakemuksia ei voi jättää tai muuttaa.",
					)}
				</Callout>
			)}

			<dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-stone-300 bg-stone-50 p-4 text-sm sm:grid-cols-2 dark:border-stone-700 dark:bg-stone-900">
				<DateItem label={t("hakuaikaAlkaa", "Haku alkaa")}>
					{formatDateTime(round.applications_open_at)}
				</DateItem>
				<DateItem label={t("hakuaikaPttyy", "Haku päättyy")}>
					{formatDateTime(round.applications_close_at)}
				</DateItem>
				<DateItem label={t("kierroksenAjanjakso", "Varattava ajanjakso")}>
					{`${formatDateOnly(round.period_start)} – ${formatDateOnly(round.period_end)}`}
				</DateItem>
				<DateItem label={t("resurssit", "Resurssit")}>
					{round.resource_ids.map(resourceName).join(", ")}
				</DateItem>
			</dl>

			<h2 className="text-lg font-semibold">
				{t("omatHakemukset", "Omat hakemukset")}
			</h2>

			{byResource.size === 0 && (
				<EmptyState
					title={t(
						"eiOmiaHakemuksia",
						"Sinulla ei ole hakemuksia tällä kierroksella.",
					)}
				/>
			)}

			{[...byResource.entries()].map(([resourceId, list]) => (
				<section key={resourceId} className="space-y-2">
					<h3 className="text-base font-bold">
						{resourceName(resourceId)}
						<span className="ml-2 text-xs font-normal text-stone-600 dark:text-stone-400">
							{`${t("jaljella", "jäljellä")}: ${remainingApplications(round.max_pending_per_resource, list.length)}`}
						</span>
					</h3>
					<ol className="space-y-2">
						{list.map((app, index) => (
							<li
								key={app.id}
								className="flex items-center gap-3 rounded-md border border-stone-300 bg-stone-50 p-3 dark:border-stone-700 dark:bg-stone-900"
							>
								<span className="w-6 text-center font-bold tabular-nums">{`${index + 1}.`}</span>
								<div className="min-w-0 flex-1 text-sm">
									<div className="truncate font-medium">{app.title}</div>
									<div className="text-xs tabular-nums text-stone-600 dark:text-stone-400">
										{formatRange(
											app.occurrences[0]?.start_time,
											app.occurrences[0]?.end_time,
										)}
									</div>
								</div>
								{isOpen && (
									<div className="flex gap-1">
										<Button
											variant="outline"
											size="iconSm"
											aria-label={t("siirraYlos", "Siirrä ylös")}
											title={t("siirraYlos", "Siirrä ylös")}
											disabled={index === 0 || setPriorities.isPending}
											onClick={() => move(resourceId, index, -1)}
										>
											<ArrowUp size={14} />
										</Button>
										<Button
											variant="outline"
											size="iconSm"
											aria-label={t("siirraAlas", "Siirrä alas")}
											title={t("siirraAlas", "Siirrä alas")}
											disabled={
												index === list.length - 1 || setPriorities.isPending
											}
											onClick={() => move(resourceId, index, 1)}
										>
											<ArrowDown size={14} />
										</Button>
										<Button
											variant="outline"
											size="iconSm"
											aria-label={t("peruHakemus", "Peru hakemus")}
											title={t("peruHakemus", "Peru hakemus")}
											disabled={cancel.isPending}
											onClick={() => cancel.mutate({ id: app.id })}
										>
											<X size={14} />
										</Button>
									</div>
								)}
							</li>
						))}
					</ol>
				</section>
			))}
			{(setPriorities.isError || cancel.isError) && (
				<Callout variant="danger">
					{(setPriorities.error ?? cancel.error)?.message}
				</Callout>
			)}
		</DetailLayout>
	);
}

function DateItem({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="min-w-0 space-y-0.5">
			<dt className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400">
				{label}
			</dt>
			<dd className="tabular-nums">{children}</dd>
		</div>
	);
}
