import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import {
	type SyncLogEntry,
	useOutlookSyncStatus,
	useRunOutlookSync,
} from "#/hooks/useOutlookSync";
import { requireAdminGuard } from "#/utils/authGuard";
import { cn } from "#/utils/cn";
import { useDateFormatter } from "#/utils/date";

export const Route = createFileRoute("/_app/admin/outlook")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: OutlookSyncPage,
});

const RESULT_STYLES: Record<string, string> = {
	imported:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
	updated: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
	cancelled:
		"bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300",
	ignored: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
	error: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

function OutlookSyncPage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
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
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataan", "Ladataan...")}</span>
			</div>
		);
	}
	if (isError || !status) {
		return (
			<div className="p-8 text-sm text-rose-600">
				{t(
					"outlookTilanHakuEpaonnistui",
					"Outlook-synkronoinnin tilan hakeminen epäonnistui.",
				)}
			</div>
		);
	}

	const report = run.data;

	return (
		<div className="p-4 max-w-4xl mx-auto space-y-5">
			<div>
				<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
					{t("outlookSynkronointi", "Outlook-synkronointi")}
				</h1>
				<p className="text-sm text-stone-600 dark:text-stone-400 mt-1">
					{t(
						"outlookSynkronointiKuvaus",
						"Kutsu resurssit ja alla oleva osoite Outlook-tapahtumaan, niin tapahtuma näkyy varauksena Kuutarissa. Resurssin Outlook-osoite asetetaan resurssin muokkauksessa.",
					)}
				</p>
			</div>

			<div className="p-4 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900 space-y-3">
				{status.enabled ? (
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
						<dt className="text-stone-500">
							{t("outlookVastaanottoosoite", "Vastaanottoosoite")}
						</dt>
						<dd className="font-mono">{status.intake_mailbox}</dd>
						<dt className="text-stone-500">
							{t("outlookViimeisinHaku", "Viimeisin haku")}
						</dt>
						<dd>
							{status.last_run_at
								? formatDate(status.last_run_at)
								: t("outlookEiVielaHaettu", "Ei vielä haettu")}
						</dd>
						{status.last_error && (
							<>
								<dt className="text-stone-500">{t("outlookVirhe", "Virhe")}</dt>
								<dd className="text-rose-600 dark:text-rose-400 break-words">
									{status.last_error}
								</dd>
							</>
						)}
					</dl>
				) : (
					<p className="text-sm text-amber-700 dark:text-amber-400">
						{t(
							"outlookEiKaytossa",
							"Outlook-integraatio ei ole käytössä. Palvelimelta puuttuvat GRAPH_*-asetukset.",
						)}
					</p>
				)}

				<div className="flex flex-wrap items-center gap-3">
					<Button
						size="sm"
						variant="outline"
						disabled={!status.enabled || run.isPending}
						onClick={() => run.mutate()}
						className="gap-1 text-xs"
					>
						{run.isPending ? (
							<Loader2 className="animate-spin" size={14} />
						) : (
							<RefreshCw size={14} />
						)}
						<span>{t("outlookHaeNyt", "Hae nyt")}</span>
					</Button>
					{report && (
						<span className="text-xs text-stone-600 dark:text-stone-400">
							{t(
								"outlookHakuTulos",
								"{{messages}} viestiä: {{imported}} tuotu, {{updated}} päivitetty, {{cancelled}} peruttu, {{ignored}} ohitettu, {{errors}} virhettä",
								report,
							)}
						</span>
					)}
					{run.isError && (
						<span className="text-xs text-rose-600">{run.error.message}</span>
					)}
				</div>
			</div>

			<section className="space-y-2">
				<h2 className="text-sm font-semibold text-stone-800 dark:text-stone-200">
					{t("outlookViimeisimmatViestit", "Viimeisimmät viestit")}
				</h2>
				{status.recent.length === 0 ? (
					<p className="text-sm text-stone-500">
						{t("outlookEiViesteja", "Ei käsiteltyjä viestejä.")}
					</p>
				) : (
					<ul className="divide-y divide-stone-200 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-md">
						{status.recent.map((entry) => (
							<LogRow
								key={entry.id}
								entry={entry}
								label={resultLabels[entry.result] ?? entry.result}
								when={formatDate(entry.created_at)}
							/>
						))}
					</ul>
				)}
			</section>
		</div>
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
	return (
		<li className="p-3 flex items-start gap-3 text-xs">
			<Chip className={cn("shrink-0", RESULT_STYLES[entry.result])}>
				{label}
			</Chip>
			<div className="min-w-0 flex-1">
				<p className="font-medium text-stone-900 dark:text-stone-100 truncate">
					{entry.reservation_id ? (
						<Link
							to="/reservations/$id"
							params={{ id: entry.reservation_id }}
							className="hover:underline"
						>
							{entry.subject || "—"}
						</Link>
					) : (
						(entry.subject ?? "—")
					)}
				</p>
				{entry.detail && (
					<p className="text-stone-500 dark:text-stone-400 break-words">
						{entry.detail}
					</p>
				)}
			</div>
			<span className="text-stone-400 shrink-0">{when}</span>
		</li>
	);
}
