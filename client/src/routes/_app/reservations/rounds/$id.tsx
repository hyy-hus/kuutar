import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Loader2, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
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
	const { formatDate, formatDateRange } = useDateFormatter();
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

	return (
		<div className="max-w-xl mx-auto space-y-4 pb-12">
			<BackLink to="/reservations">
				{t("takaisinVarauksiin", "Takaisin varauksiin")}
			</BackLink>
			<h1 className="text-xl font-bold">{round.name}</h1>
			{round.description && <p className="text-sm">{round.description}</p>}
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{`${t("hakuaika", "Hakuaika")}: ${formatDate(round.applications_open_at)} – ${formatDate(round.applications_close_at)}`}
			</p>
			<p className="text-sm">
				{t(
					"kierrosOhje",
					"Voit hakea resurssia kohden enintään {{max}} varausjaksoa. Järjestä hakemuksesi mieluisuusjärjestykseen: ylin on toivotuin. Päätökset lähetetään sähköpostilla kierroksen päätyttyä.",
					{ max: round.max_pending_per_resource },
				)}
			</p>

			{byResource.size === 0 && (
				<p className="text-sm text-stone-500">
					{t(
						"eiOmiaHakemuksia",
						"Sinulla ei ole hakemuksia tällä kierroksella.",
					)}
				</p>
			)}

			{[...byResource.entries()].map(([resourceId, list]) => (
				<section key={resourceId} className="space-y-2">
					<h2 className="font-bold">
						{resources?.find((r) => r.id === resourceId)?.name}
						<span className="text-xs font-normal text-stone-500">
							{` (${t("jaljella", "jäljellä")}: ${remainingApplications(round.max_pending_per_resource, list.length)})`}
						</span>
					</h2>
					<ol className="space-y-2">
						{list.map((app, index) => (
							<li
								key={app.id}
								className="p-3 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900 flex items-center gap-3"
							>
								<span className="font-bold w-6 text-center">{`${index + 1}.`}</span>
								<div className="flex-1 min-w-0 text-sm">
									<div className="font-medium truncate">{app.title}</div>
									<div className="text-xs text-stone-600 dark:text-stone-400">
										{formatDateRange(
											app.occurrences[0]?.start_time,
											app.occurrences[0]?.end_time,
										)}
									</div>
								</div>
								{isOpen && (
									<div className="flex gap-1">
										<Button
											variant="secondary"
											size="sm"
											aria-label={t("siirraYlos", "Siirrä ylös")}
											disabled={index === 0 || setPriorities.isPending}
											onClick={() => move(resourceId, index, -1)}
										>
											<ArrowUp size={14} />
										</Button>
										<Button
											variant="secondary"
											size="sm"
											aria-label={t("siirraAlas", "Siirrä alas")}
											disabled={
												index === list.length - 1 || setPriorities.isPending
											}
											onClick={() => move(resourceId, index, 1)}
										>
											<ArrowDown size={14} />
										</Button>
										<Button
											variant="secondary"
											size="sm"
											aria-label={t("peruHakemus", "Peru hakemus")}
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
				<p role="alert" className="text-sm text-red-600">
					{(setPriorities.error ?? cancel.error)?.message}
				</p>
			)}
		</div>
	);
}
