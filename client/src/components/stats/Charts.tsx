import { useTranslation } from "react-i18next";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { MonthlyStat, TopResourceStat } from "#/hooks/useStats";
import { formatHours, formatMonth, heatLevel } from "#/utils/statsUtils";

// Text and grid use currentColor so they follow the light/dark text color
const TICK = { fill: "currentColor", fontSize: 12 };
// Single accent for bars (purple); dark mode uses a lighter step
const BAR_COLOR_CLASS =
	"[--bar:var(--color-purple-600)] dark:[--bar:var(--color-purple-400)]";
const TOOLTIP_STYLE = {
	background: "var(--color-stone-900, #1c1917)",
	border: "1px solid var(--color-stone-700, #44403c)",
	borderRadius: 6,
	color: "#fafaf9",
	fontSize: 12,
};

export function MonthlyChart({ data }: { data: MonthlyStat[] }) {
	const { t, i18n } = useTranslation();
	const rows = data.map((d) => ({
		...d,
		label: formatMonth(d.month, i18n.language),
	}));

	return (
		<div
			className={`h-56 text-stone-600 dark:text-stone-400 ${BAR_COLOR_CLASS}`}
			role="img"
			aria-label={t("varauksiaKuukaudessa", "Varauksia kuukaudessa")}
		>
			<ResponsiveContainer width="100%" height="100%">
				<BarChart
					data={rows}
					margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
				>
					<CartesianGrid
						stroke="currentColor"
						strokeOpacity={0.2}
						vertical={false}
					/>
					<XAxis dataKey="label" tick={TICK} tickLine={false} />
					<YAxis tick={TICK} tickLine={false} allowDecimals={false} />
					<Tooltip
						contentStyle={TOOLTIP_STYLE}
						cursor={{ fill: "currentColor", fillOpacity: 0.1 }}
						formatter={(value, name) => [
							name === "hours"
								? formatHours(Number(value), i18n.language)
								: value,
							name === "hours"
								? t("tuntia", "Tuntia")
								: t("varaukset", "Varaukset"),
						]}
					/>
					<Bar dataKey="count" fill="var(--bar)" radius={[3, 3, 0, 0]} />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

export function TopResourcesChart({ data }: { data: TopResourceStat[] }) {
	const { t } = useTranslation();
	const height = Math.max(120, data.length * 36 + 24);

	return (
		<div
			className={`text-stone-600 dark:text-stone-400 ${BAR_COLOR_CLASS}`}
			style={{ height }}
			role="img"
			aria-label={t("suosituimmatResurssit", "Suosituimmat resurssit")}
		>
			<ResponsiveContainer width="100%" height="100%">
				<BarChart
					data={data}
					layout="vertical"
					margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
				>
					<CartesianGrid
						stroke="currentColor"
						strokeOpacity={0.2}
						horizontal={false}
					/>
					<XAxis
						type="number"
						tick={TICK}
						tickLine={false}
						allowDecimals={false}
					/>
					<YAxis
						type="category"
						dataKey="resource_name"
						width={110}
						tick={TICK}
						tickLine={false}
					/>
					<Tooltip
						contentStyle={TOOLTIP_STYLE}
						cursor={{ fill: "currentColor", fillOpacity: 0.1 }}
						formatter={(value) => [value, t("varaukset", "Varaukset")]}
					/>
					<Bar dataKey="count" fill="var(--bar)" radius={[0, 3, 3, 0]} />
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}

const HEAT_CLASSES = [
	"bg-stone-200 dark:bg-stone-800",
	"bg-purple-200 dark:bg-purple-950",
	"bg-purple-300 dark:bg-purple-900",
	"bg-purple-500 dark:bg-purple-700",
	"bg-purple-700 dark:bg-purple-400",
] as const;

/** Weekday × hour grid; shows only the hours that have any activity */
export function WeekdayHourHeatmap({
	cells,
}: {
	cells: { weekday: number; hour: number; count: number }[];
}) {
	const { t, i18n } = useTranslation();
	const counts = new Map(cells.map((c) => [`${c.weekday}-${c.hour}`, c.count]));
	const max = Math.max(0, ...cells.map((c) => c.count));
	if (cells.length === 0) return null;
	const hours = cells.map((c) => c.hour);
	const first = Math.min(...hours);
	const last = Math.max(...hours);
	const range = Array.from({ length: last - first + 1 }, (_, i) => first + i);
	// 2024-01-01 was a Monday
	const weekdayName = (d: number) =>
		new Date(Date.UTC(2024, 0, 1 + d)).toLocaleDateString(i18n.language, {
			weekday: "short",
			timeZone: "UTC",
		});

	return (
		<div className="space-y-3">
			<div className="overflow-x-auto">
				<table
					className="border-separate border-spacing-0.5 text-xs tabular-nums text-stone-600 dark:text-stone-400"
					aria-label={t(
						"varauksetViikonpivinJaTunneittain",
						"Varaukset viikonpäivittäin ja tunneittain",
					)}
				>
					<thead>
						<tr>
							<th />
							{range.map((h) => (
								<th key={h} className="font-normal w-6 text-center">
									{h}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{Array.from({ length: 7 }, (_, d) => d).map((d) => (
							<tr key={d}>
								<th className="font-normal pr-2 text-right">
									{weekdayName(d)}
								</th>
								{range.map((h) => {
									const count = counts.get(`${d}-${h}`) ?? 0;
									return (
										<td
											key={h}
											title={`${weekdayName(d)} ${h}:00 – ${count}`}
											className={`h-6 w-6 rounded-sm ${HEAT_CLASSES[heatLevel(count, max)]}`}
										/>
									);
								})}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			<div
				className="flex items-center gap-2 text-xs text-stone-600 dark:text-stone-400"
				aria-hidden="true"
			>
				<span>{t("tilastotVahemman", "Vähemmän")}</span>
				{HEAT_CLASSES.map((cls) => (
					<span key={cls} className={`size-4 rounded-sm ${cls}`} />
				))}
				<span>{t("tilastotEnemman", "Enemmän")}</span>
			</div>
		</div>
	);
}
