import {
	Activity,
	Bookmark,
	Box,
	CalendarClock,
	CalendarDays,
	Clock,
	Grid3x3,
	Hourglass,
	TrendingUp,
	UserPlus,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AdminStats, MyStats, PublicStats } from "#/hooks/useStats";
import { formatHours } from "#/utils/statsUtils";
import { MonthlyChart, TopResourcesChart, WeekdayHourHeatmap } from "./Charts";
import { EmptyNote, Panel, SectionHeading, StatCard } from "./StatsPanel";

const GRID = "grid grid-cols-2 md:grid-cols-4 gap-4";
const ROW = "grid grid-cols-1 lg:grid-cols-2 gap-6";

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
		<div className="space-y-6">
			<SectionHeading>{t("yleiskatsaus", "Yleiskatsaus")}</SectionHeading>
			<div className={GRID}>
				<StatCard
					label={t("varaukset", "Varaukset")}
					value={stats.totals.occurrences}
					icon={Bookmark}
				/>
				<StatCard
					label={t("tuntia", "Tuntia")}
					value={formatHours(stats.totals.hours, i18n.language)}
					icon={Clock}
				/>
				<StatCard
					label={t("kytettyjResursseja", "Käytettyjä resursseja")}
					value={`${stats.totals.resources_used} / ${stats.public_resources}`}
					icon={Box}
				/>
				<StatCard
					label={t("keskimrinKuukaudessa", "Keskim. kuukaudessa")}
					value={
						stats.monthly.length
							? Math.round(stats.totals.occurrences / stats.monthly.length)
							: 0
					}
					icon={CalendarDays}
				/>
			</div>

			<Panel
				title={t("varauksiaKuukaudessa", "Varauksia kuukaudessa")}
				icon={Activity}
			>
				{empty ? noData : <MonthlyChart data={stats.monthly} />}
			</Panel>

			<div className={ROW}>
				<Panel
					title={t("suosituimmatResurssit", "Suosituimmat resurssit")}
					icon={TrendingUp}
				>
					{stats.top_resources.length ? (
						<TopResourcesChart data={stats.top_resources} />
					) : (
						noData
					)}
				</Panel>
				<Panel
					title={t("ruuhkaAjat", "Ruuhka-ajat")}
					icon={Grid3x3}
					iconClass="text-emerald-600 dark:text-emerald-400"
				>
					{empty ? noData : <WeekdayHourHeatmap cells={stats.weekday_hour} />}
				</Panel>
			</div>
		</div>
	);
}

export function MySection({ stats }: { stats: MyStats }) {
	const { t, i18n } = useTranslation();
	const noData = useNoData();

	return (
		<div className="space-y-6">
			<SectionHeading>{t("omatTilastot", "Omat tilastot")}</SectionHeading>
			<div className={GRID}>
				<StatCard
					label={t("toteutuneet", "Toteutuneet")}
					value={stats.totals.occurrences}
					icon={Bookmark}
				/>
				<StatCard
					label={t("tuntia", "Tuntia")}
					value={formatHours(stats.totals.hours, i18n.language)}
					icon={Clock}
				/>
				<StatCard
					label={t("odottavat", "Odottavat")}
					value={stats.statuses.pending}
					icon={Hourglass}
					accent="text-amber-600 dark:text-amber-400"
				/>
				<StatCard
					label={t("vahvistetut", "Vahvistetut")}
					value={stats.statuses.confirmed}
					icon={Bookmark}
					accent="text-emerald-600 dark:text-emerald-400"
				/>
			</div>

			<div className={ROW}>
				<Panel
					title={t("omatVarauksetKuukaudessa", "Omat varaukset kuukaudessa")}
					icon={Activity}
				>
					{stats.totals.occurrences ? (
						<MonthlyChart data={stats.monthly} />
					) : (
						noData
					)}
				</Panel>
				<Panel
					title={t("omatSuosikit", "Omat suosikkiresurssit")}
					icon={TrendingUp}
				>
					{stats.favourite_resources.length ? (
						<TopResourcesChart data={stats.favourite_resources} />
					) : (
						noData
					)}
				</Panel>
			</div>

			<Panel
				title={t("tulevatVaraukset", "Tulevat varaukset")}
				icon={CalendarClock}
				iconClass="text-sky-600 dark:text-sky-400"
			>
				{stats.upcoming.length ? (
					<ul className="divide-y divide-stone-200 dark:divide-stone-800 text-xs font-mono">
						{stats.upcoming.map((u) => (
							<li
								key={`${u.reservation_id}-${u.start_time}`}
								className="py-2 flex flex-wrap items-center justify-between gap-x-4"
							>
								<span className="font-bold text-stone-900 dark:text-stone-100">
									{`${u.title} · ${u.resource_name}`}
								</span>
								<span className="text-stone-500">
									{new Date(u.start_time).toLocaleString(i18n.language, {
										dateStyle: "short",
										timeStyle: "short",
									})}
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
					<div className="flex items-center justify-between gap-2 text-xs font-mono">
						<span className="font-bold text-stone-900 dark:text-stone-100 truncate">
							{r.label}
						</span>
						<span className="text-stone-500 shrink-0">
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
		<div className="space-y-6">
			<SectionHeading>{t("yllpito", "Ylläpito")}</SectionHeading>
			<div className={GRID}>
				<StatCard
					label={t("kyttjt", "Käyttäjät")}
					value={stats.total_users}
					icon={Users}
				/>
				<StatCard
					label={t("resurssit", "Resurssit")}
					value={stats.total_resources}
					icon={Box}
					hint={`${t("ryhmt", "Ryhmät")}: ${stats.total_groups}`}
				/>
				<StatCard
					label={t("odottavatNyt", "Odottavat nyt")}
					value={stats.pending_now}
					icon={Hourglass}
					accent="text-amber-600 dark:text-amber-400"
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
					icon={Activity}
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
					icon={Activity}
				>
					{stats.totals.occurrences ? (
						<MonthlyChart data={stats.monthly} />
					) : (
						noData
					)}
				</Panel>
				<Panel
					title={t("varaustenTilajakauma", "Varausten tilajakauma")}
					icon={Bookmark}
					iconClass="text-emerald-600 dark:text-emerald-400"
				>
					<div className="space-y-3 text-xs font-mono">
						{(
							[
								[
									"confirmed",
									t("vahvistetutVaraukset", "Vahvistetut varaukset"),
									"bg-emerald-500",
								],
								[
									"pending",
									t("odottavatPyynnt", "Odottavat pyynnöt"),
									"bg-amber-500",
								],
								["cancelled", t("peruutetut", "Peruutetut"), "bg-rose-500"],
							] as const
						).map(([key, label, dot]) => (
							<div
								key={key}
								className="p-3 border border-stone-200 dark:border-stone-800 rounded bg-stone-100 dark:bg-stone-950 flex items-center justify-between"
							>
								<span className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
									<span className={`w-2 h-2 rounded-full ${dot}`} />
									{label}
								</span>
								<span className="font-bold text-stone-900 dark:text-stone-100">
									{statuses[key]}
								</span>
							</div>
						))}
					</div>
				</Panel>
			</div>

			<div className={ROW}>
				<Panel title={t("ryhmienKaytto", "Ryhmien käyttö")} icon={Users}>
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
				<Panel
					title={t("aktiivisimmatKyttjt", "Aktiivisimmat käyttäjät")}
					icon={TrendingUp}
				>
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
					icon={Box}
				>
					{stats.top_resources.length ? (
						<TopResourcesChart data={stats.top_resources} />
					) : (
						noData
					)}
				</Panel>
				<div className="space-y-6 min-w-0">
					<Panel
						title={t("kyttmttmtResurssit", "Käyttämättömät resurssit")}
						icon={Box}
						iconClass="text-rose-600 dark:text-rose-400"
					>
						{stats.unused_resources.length ? (
							<ul className="flex flex-wrap gap-2 text-xs font-mono">
								{stats.unused_resources.map((r) => (
									<li
										key={r.resource_id}
										className="px-2 py-1 border border-stone-300 dark:border-stone-700 rounded"
									>
										{r.resource_name}
									</li>
								))}
							</ul>
						) : (
							<EmptyNote>
								{t("kaikkiKytossa", "Kaikilla resursseilla on varauksia.")}
							</EmptyNote>
						)}
					</Panel>
					<Panel title={t("uudetKyttjt", "Uudet käyttäjät")} icon={UserPlus}>
						{stats.new_users.length ? (
							<ul className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-mono">
								{stats.new_users.map((m) => (
									<li key={m.month}>
										<span className="text-stone-500">{m.month}</span>{" "}
										<span className="font-bold text-stone-900 dark:text-stone-100">
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
