import { Check, Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Chip } from "#/components/Chip";
import type { AdminStats, MyStats, PublicStats } from "#/hooks/useStats";
import { useDateFormatter } from "#/utils/date";
import { formatHours } from "#/utils/statsUtils";
import { MonthlyChart, TopResourcesChart, WeekdayHourHeatmap } from "./Charts";
import { EmptyNote, Panel, SectionHeading, StatCard } from "./StatsPanel";

const GRID = "grid grid-cols-2 lg:grid-cols-4 gap-4";
const ROW = "grid grid-cols-1 lg:grid-cols-2 gap-4";

function useNoData() {
	const { t } = useTranslation();
	return (
		<EmptyNote>
			{t(
				"eiVielVaraustilastojaSaatavilla",
				"Ei vielä varaustilastoja saatavilla.",
			)}
		</EmptyNote>
	);
}

export function OverviewSection({ stats }: { stats: PublicStats }) {
	const { t, i18n } = useTranslation();
	const noData = useNoData();
	const empty = stats.totals.occurrences === 0;

	return (
		<div className="space-y-4">
			<div className={GRID}>
				<StatCard
					label={t("varaukset", "Varaukset")}
					value={stats.totals.occurrences}
				/>
				<StatCard
					label={t("tuntia", "Tuntia")}
					value={formatHours(stats.totals.hours, i18n.language)}
				/>
				<StatCard
					label={t("kytettyjResursseja", "Käytettyjä resursseja")}
					value={`${stats.totals.resources_used} / ${stats.public_resources}`}
				/>
				<StatCard
					label={t("keskimrinKuukaudessa", "Keskim. kuukaudessa")}
					value={
						stats.monthly.length
							? Math.round(stats.totals.occurrences / stats.monthly.length)
							: 0
					}
				/>
			</div>

			<Panel title={t("varauksiaKuukaudessa", "Varauksia kuukaudessa")}>
				{empty ? noData : <MonthlyChart data={stats.monthly} />}
			</Panel>

			<div className={ROW}>
				<Panel title={t("suosituimmatResurssit", "Suosituimmat resurssit")}>
					{stats.top_resources.length ? (
						<TopResourcesChart data={stats.top_resources} />
					) : (
						noData
					)}
				</Panel>
				<Panel title={t("ruuhkaAjat", "Ruuhka-ajat")}>
					{empty ? noData : <WeekdayHourHeatmap cells={stats.weekday_hour} />}
				</Panel>
			</div>
		</div>
	);
}

export function MySection({ stats }: { stats: MyStats }) {
	const { t, i18n } = useTranslation();
	const { formatDateTime } = useDateFormatter();
	const noData = useNoData();

	return (
		<div className="space-y-4">
			<SectionHeading>{t("omatTilastot", "Omat tilastot")}</SectionHeading>
			<div className={GRID}>
				<StatCard
					label={t("toteutuneet", "Toteutuneet")}
					value={stats.totals.occurrences}
				/>
				<StatCard
					label={t("tuntia", "Tuntia")}
					value={formatHours(stats.totals.hours, i18n.language)}
				/>
				<StatCard
					label={t("odottavat", "Odottavat")}
					value={stats.statuses.pending}
				/>
				<StatCard
					label={t("vahvistetut", "Vahvistetut")}
					value={stats.statuses.confirmed}
				/>
			</div>

			<div className={ROW}>
				<Panel
					title={t("omatVarauksetKuukaudessa", "Omat varaukset kuukaudessa")}
				>
					{stats.totals.occurrences ? (
						<MonthlyChart data={stats.monthly} />
					) : (
						noData
					)}
				</Panel>
				<Panel title={t("omatSuosikit", "Omat suosikkiresurssit")}>
					{stats.favourite_resources.length ? (
						<TopResourcesChart data={stats.favourite_resources} />
					) : (
						noData
					)}
				</Panel>
			</div>

			<Panel title={t("tulevatVaraukset", "Tulevat varaukset")}>
				{stats.upcoming.length ? (
					<ul className="divide-y divide-stone-300 dark:divide-stone-700 text-sm">
						{stats.upcoming.map((u) => (
							<li
								key={`${u.reservation_id}-${u.start_time}`}
								className="py-2 flex flex-wrap items-center justify-between gap-x-4"
							>
								<span className="font-medium text-stone-900 dark:text-stone-100">
									{`${u.title} · ${u.resource_name}`}
								</span>
								<span className="text-stone-600 dark:text-stone-400 tabular-nums">
									{formatDateTime(u.start_time)}
								</span>
							</li>
						))}
					</ul>
				) : (
					<EmptyNote>{t("eiTulevia", "Ei tulevia varauksia.")}</EmptyNote>
				)}
			</Panel>
		</div>
	);
}

function BarList({
	rows,
}: {
	rows: { key: string; label: string; count: number; hours: number }[];
}) {
	const { t, i18n } = useTranslation();
	const max = rows[0]?.count || 1;

	return (
		<ul className="space-y-3">
			{rows.map((r) => (
				<li key={r.key} className="space-y-1">
					<div className="flex items-center justify-between gap-2 text-sm">
						<span className="font-medium text-stone-900 dark:text-stone-100 truncate">
							{r.label}
						</span>
						<span className="text-xs tabular-nums text-stone-600 dark:text-stone-400 shrink-0">
							{`${r.count} ${t("kpl", "kpl")} · ${formatHours(r.hours, i18n.language)} h`}
						</span>
					</div>
					<div className="h-2 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
						<div
							className="h-full bg-purple-600 dark:bg-purple-500 rounded-full"
							style={{ width: `${Math.round((r.count / max) * 100)}%` }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}

export function AdminSection({ stats }: { stats: AdminStats }) {
	const { t, i18n } = useTranslation();
	const noData = useNoData();
	const { statuses } = stats;
	const total = statuses.pending + statuses.confirmed + statuses.cancelled;
	const cancelRate = total ? Math.round((statuses.cancelled / total) * 100) : 0;

	return (
		<div className="space-y-4">
			<SectionHeading>{t("yllpito", "Ylläpito")}</SectionHeading>
			<div className={GRID}>
				<StatCard label={t("kyttjt", "Käyttäjät")} value={stats.total_users} />
				<StatCard
					label={t("resurssit", "Resurssit")}
					value={stats.total_resources}
					hint={`${t("ryhmt", "Ryhmät")}: ${stats.total_groups}`}
				/>
				<StatCard
					label={t("odottavatNyt", "Odottavat nyt")}
					value={stats.pending_now}
					hint={
						stats.oldest_pending_hours != null
							? t("vanhinPv", "vanhin {{days}} pv", {
									days: Math.floor(stats.oldest_pending_hours / 24),
								})
							: undefined
					}
				/>
				<StatCard
					label={t("peruutusaste", "Peruutusaste")}
					value={`${cancelRate} %`}
					hint={
						stats.avg_lead_time_days != null
							? t("keskimrinEnnakointiPv", "ennakointi keskim. {{days}} pv", {
									days: formatHours(stats.avg_lead_time_days, i18n.language),
								})
							: undefined
					}
				/>
			</div>

			<div className={ROW}>
				<Panel
					title={t(
						"kaikkiVarauksetKuukaudessa",
						"Kaikki varaukset kuukaudessa",
					)}
				>
					{stats.totals.occurrences ? (
						<MonthlyChart data={stats.monthly} />
					) : (
						noData
					)}
				</Panel>
				<Panel title={t("varaustenTilajakauma", "Varausten tilajakauma")}>
					<ul className="space-y-2 text-sm">
						{(
							[
								[
									"confirmed",
									t("vahvistetutVaraukset", "Vahvistetut varaukset"),
									Check,
									"text-emerald-700 dark:text-emerald-400",
								],
								[
									"pending",
									t("odottavatPyynnt", "Odottavat pyynnöt"),
									Clock,
									"text-amber-700 dark:text-amber-400",
								],
								[
									"cancelled",
									t("peruutetut", "Peruutetut"),
									X,
									"text-red-700 dark:text-red-400",
								],
							] as const
						).map(([key, label, Icon, tone]) => (
							<li
								key={key}
								className="px-3 py-2 rounded-md bg-stone-100 dark:bg-stone-950 flex items-center justify-between"
							>
								<span className={`flex items-center gap-2 ${tone}`}>
									<Icon size={16} aria-hidden="true" />
									{label}
								</span>
								<span className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
									{statuses[key]}
								</span>
							</li>
						))}
					</ul>
				</Panel>
			</div>

			<div className={ROW}>
				<Panel title={t("ryhmienKaytto", "Ryhmien käyttö")}>
					{stats.groups.length ? (
						<BarList
							rows={stats.groups.map((g) => ({
								key: g.group_id,
								label: g.group_name,
								count: g.count,
								hours: g.hours,
							}))}
						/>
					) : (
						noData
					)}
				</Panel>
				<Panel title={t("aktiivisimmatKyttjt", "Aktiivisimmat käyttäjät")}>
					{stats.top_users.length ? (
						<BarList
							rows={stats.top_users.map((u) => ({
								key: u.user_id,
								label: u.email,
								count: u.count,
								hours: u.hours,
							}))}
						/>
					) : (
						noData
					)}
				</Panel>
			</div>

			<div className={ROW}>
				<Panel
					title={t(
						"kaikkiResurssitSuosio",
						"Resurssien käyttö (myös yksityiset)",
					)}
				>
					{stats.top_resources.length ? (
						<TopResourcesChart data={stats.top_resources} />
					) : (
						noData
					)}
				</Panel>
				<div className="space-y-4 min-w-0">
					<Panel title={t("kyttmttmtResurssit", "Käyttämättömät resurssit")}>
						{stats.unused_resources.length ? (
							<ul className="flex flex-wrap gap-2 text-sm">
								{stats.unused_resources.map((r) => (
									<li key={r.resource_id}>
										<Chip>{r.resource_name}</Chip>
									</li>
								))}
							</ul>
						) : (
							<EmptyNote>
								{t("kaikkiKytossa", "Kaikilla resursseilla on varauksia.")}
							</EmptyNote>
						)}
					</Panel>
					<Panel title={t("uudetKyttjt", "Uudet käyttäjät")}>
						{stats.new_users.length ? (
							<ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
								{stats.new_users.map((m) => (
									<li key={m.month}>
										<span className="text-stone-600 dark:text-stone-400 tabular-nums">
											{m.month}
										</span>{" "}
										<span className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">
											{`+${m.count}`}
										</span>
									</li>
								))}
							</ul>
						) : (
							noData
						)}
					</Panel>
				</div>
			</div>
		</div>
	);
}
