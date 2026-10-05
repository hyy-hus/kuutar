import { useTranslation } from "react-i18next";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { MonthlyStat, TopResourceStat } from "#/hooks/useStats";
import { getResourceHex } from "#/utils/resourceColors";
import { formatHours, formatMonth, heatLevel } from "#/utils/statsUtils";

// Text and grid use currentColor so they follow the light/dark text color
const TICK = { fill: "currentColor", fontSize: 11, fontFamily: "monospace" };
const TOOLTIP_STYLE = {
	background: "var(--color-stone-900, #1c1917)",
	border: "1px solid var(--color-stone-700, #44403c)",
	borderRadius: 6,
	color: "#fafaf9",
	fontSize: 12,
	fontFamily: "monospace",
};

export function MonthlyChart({
	data,
	color = "#9333ea",
}: {
	data: MonthlyStat[];
	color?: string;
}) {
	const { t, i18n } = useTranslation();
	const rows = data.map((d) => ({
		...d,
		label: formatMonth(d.month, i18n.language),
	}));

	return (
		<div
			className="h-56 text-stone-500"
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
					<Bar dataKey="count" fill={color} radius={[3, 3, 0, 0]} />
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
			className="text-stone-500"
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
					<Bar dataKey="count" radius={[0, 3, 3, 0]}>
						{data.map((d) => (
							<Cell key={d.resource_id} fill={getResourceHex(d.color)} />
						))}
					</Bar>
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
		<div className="overflow-x-auto">
			<table
				className="border-separate border-spacing-0.5 text-[10px] font-mono text-stone-500"
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
							<th className="font-normal pr-2 text-right">{weekdayName(d)}</th>
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
	);
}
