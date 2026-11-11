import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertTriangle,
	Check,
	Loader2,
	type LucideIcon,
	MinusCircle,
	RefreshCw,
	X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EmptyState } from "#/components/EmptyState";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { StatusChip, type StatusChipProps } from "#/components/StatusChip";
import {
	type SyncLogEntry,
	useOutlookSyncStatus,
	useRunOutlookSync,
} from "#/hooks/useOutlookSync";
import { requireAdminGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";

export const Route = createFileRoute("/_app/admin/outlook")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: OutlookSyncPage,
});

const RESULT_STATUS: Record<
	string,
	{ variant: StatusChipProps["variant"]; icon: LucideIcon }
> = {
	imported: { variant: "success", icon: Check },
	updated: { variant: "info", icon: RefreshCw },
	cancelled: { variant: "neutral", icon: X },
	ignored: { variant: "warning", icon: MinusCircle },
	error: { variant: "danger", icon: AlertTriangle },
};

function OutlookSyncPage() {
	const { t } = useTranslation();
	const { formatDateTime } = useDateFormatter();
	const { data: status, isLoading, isError } = useOutlookSyncStatus();
	const run = useRunOutlookSync();

	const resultLabels: Record<string, string> = {
		imported: t("outlookTuotu", "Tuotu"),
		updated: t("outlookPaivitetty", "Päivitetty"),
		cancelled: t("outlookPeruttu", "Peruttu"),
		ignored: t("outlookOhitettu", "Ohitettu"),
		error: t("outlookVirhe", "Virhe"),
	};

	if (isLoading) {
		return (
			<div className="flex items-center gap-2 text-stone-600 dark:text-stone-400">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataan", "Ladataan...")}</span>
			</div>
		);
	}
	if (isError || !status) {
		return (
			<Callout variant="danger">
				{t(
					"outlookTilanHakuEpaonnistui",
					"Outlook-synkronoinnin tilan hakeminen epäonnistui.",
				)}
			</Callout>
		);
	}

	const report = run.data;

	return (
		<PageContainer width="default">
			<PageHeader
				title={t("outlookSynkronointi", "Outlook-synkronointi")}
				subtitle={t(
					"outlookSynkronointiKuvaus",
					"Kutsu resurssit ja alla oleva osoite Outlook-tapahtumaan, niin tapahtuma näkyy varauksena Kuutarissa. Resurssin Outlook-osoite asetetaan resurssin muokkauksessa.",
				)}
				actions={
					<Button
						variant="outline"
						disabled={!status.enabled || run.isPending}
						onClick={() => run.mutate()}
						className="gap-2"
					>
						{run.isPending ? (
							<Loader2 className="animate-spin" size={16} />
						) : (
							<RefreshCw size={16} />
						)}
						<span>{t("outlookHaeNyt", "Hae nyt")}</span>
					</Button>
				}
			/>

			{status.enabled ? (
				<section className="space-y-3 rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						<dt className="text-stone-600 dark:text-stone-400">
							{t("outlookVastaanottoosoite", "Vastaanottoosoite")}
						</dt>
						<dd className="font-mono break-all">{status.intake_mailbox}</dd>
						<dt className="text-stone-600 dark:text-stone-400">
							{t("outlookViimeisinHaku", "Viimeisin haku")}
						</dt>
						<dd className="tabular-nums">
							{status.last_run_at
								? formatDateTime(status.last_run_at)
								: t("outlookEiVielaHaettu", "Ei vielä haettu")}
						</dd>
						{status.last_error && (
							<>
								<dt className="text-stone-600 dark:text-stone-400">
									{t("outlookVirhe", "Virhe")}
								</dt>
								<dd className="text-red-700 dark:text-red-400 break-words">
									{status.last_error}
								</dd>
							</>
						)}
					</dl>
					{report && (
						<p className="text-xs text-stone-600 dark:text-stone-400">
							{t(
								"outlookHakuTulos",
								"{{messages}} viestiä: {{imported}} tuotu, {{updated}} päivitetty, {{cancelled}} peruttu, {{ignored}} ohitettu, {{errors}} virhettä",
								report,
							)}
						</p>
					)}
					{run.isError && (
						<p className="text-xs text-red-600 dark:text-red-400">
							{run.error.message}
						</p>
					)}
				</section>
			) : (
				<Callout variant="warning">
					<p>
						{t(
							"outlookEiKaytossa",
							"Outlook-integraatio ei ole käytössä. Palvelimelta puuttuvat GRAPH_*-asetukset.",
						)}
					</p>
					<p>
						{t(
							"outlookHaeNytEiKaytettavissa",
							"Hae nyt -toiminto on pois käytöstä, kunnes integraatio on otettu käyttöön.",
						)}
					</p>
				</Callout>
			)}

			<section className="space-y-3">
				<h2 className="text-lg font-semibold">
					{t("outlookViimeisimmatViestit", "Viimeisimmät viestit")}
				</h2>
				{status.recent.length === 0 ? (
					<EmptyState
						title={t("outlookEiViesteja", "Ei käsiteltyjä viestejä.")}
					/>
				) : (
					<div className="overflow-x-auto rounded-md border border-stone-300 dark:border-stone-700">
						<table className="w-full text-sm">
							<thead className="bg-stone-100 text-left dark:bg-stone-900">
								<tr className="font-mono text-xs uppercase tracking-wider text-stone-600 dark:text-stone-400">
									<th scope="col" className="w-px px-3 py-2 font-normal">
										{t("tila", "Tila")}
									</th>
									<th scope="col" className="px-3 py-2 font-normal">
										{t("aihe", "Aihe")}
									</th>
									<th
										scope="col"
										className="w-px px-3 py-2 text-right font-normal"
									>
										{t("aika", "Aika")}
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-stone-200 dark:divide-stone-800">
								{status.recent.map((entry) => (
									<LogRow
										key={entry.id}
										entry={entry}
										label={resultLabels[entry.result] ?? entry.result}
										when={formatDateTime(entry.created_at)}
									/>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</PageContainer>
	);
}

function LogRow({
	entry,
	label,
	when,
}: {
	entry: SyncLogEntry;
	label: string;
	when: string;
}) {
	const style = RESULT_STATUS[entry.result];
	return (
		<tr className="align-top">
			<td className="px-3 py-2">
				<StatusChip variant={style?.variant} icon={style?.icon}>
					{label}
				</StatusChip>
			</td>
			<td className="min-w-0 px-3 py-2">
				<p className="font-medium text-stone-900 dark:text-stone-100 wrap-break-word">
					{entry.reservation_id ? (
						<Link
							to="/reservations/$id"
							params={{ id: entry.reservation_id }}
							className="text-purple-700 hover:underline dark:text-purple-400"
						>
							{entry.subject || "—"}
						</Link>
					) : (
						(entry.subject ?? "—")
					)}
				</p>
				{entry.detail && (
					<p className="text-xs text-stone-600 dark:text-stone-400 break-words">
						{entry.detail}
					</p>
				)}
			</td>
			<td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-stone-600 dark:text-stone-400">
				{when}
			</td>
		</tr>
	);
}
