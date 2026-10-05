import { useTranslation } from "react-i18next";
import { STATS_RANGES, type StatsRange } from "#/utils/statsUtils";

export function RangeSelect({
	value,
	onChange,
}: {
	value: StatsRange;
	onChange: (range: StatsRange) => void;
}) {
	const { t } = useTranslation();
	const labels: Record<StatsRange, string> = {
		"30d": t("tilastot30Paivaa", "30 pv"),
		"90d": t("tilastot90Paivaa", "90 pv"),
		"12m": t("tilastot12Kuukautta", "12 kk"),
		all: t("tilastotKaikki", "Kaikki"),
	};

	return (
		<fieldset className="inline-flex border-2 border-stone-800 dark:border-stone-700 rounded-md overflow-hidden">
			<legend className="sr-only">{t("aikavli", "Aikaväli")}</legend>
			{STATS_RANGES.map((r) => (
				<button
					key={r}
					type="button"
					aria-pressed={value === r}
					onClick={() => onChange(r)}
					className={`px-3 py-1.5 text-xs font-mono font-bold cursor-pointer ${
						value === r
							? "bg-stone-800 text-stone-50 dark:bg-stone-200 dark:text-stone-900"
							: "bg-stone-50 text-stone-700 hover:bg-stone-200 dark:bg-stone-900 dark:text-stone-300 dark:hover:bg-stone-800"
					}`}
				>
					{labels[r]}
				</button>
			))}
		</fieldset>
	);
}
