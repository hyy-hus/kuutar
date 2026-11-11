import { useTranslation } from "react-i18next";
import { SegmentedControl } from "#/components/SegmentedControl";
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
		<SegmentedControl
			aria-label={t("aikavli", "Aikaväli")}
			value={value}
			onChange={onChange}
			options={STATS_RANGES.map((r) => ({ value: r, label: labels[r] }))}
		/>
	);
}
