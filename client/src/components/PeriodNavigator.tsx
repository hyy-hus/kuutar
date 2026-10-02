import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { formatYYYYMMDD } from "#/utils/date";
import {
	type PeriodMonths,
	parsePeriodMonths,
	shiftPeriod,
} from "#/utils/period";

interface PeriodNavigatorProps {
	/** First day of the current period */
	start: Date;
	months: PeriodMonths;
	onChange: (next: { start_date?: string; months?: PeriodMonths }) => void;
}

/** Previous/next arrows, a start date picker and a period length selector */
export function PeriodNavigator({
	start,
	months,
	onChange,
}: PeriodNavigatorProps) {
	const { t } = useTranslation();

	return (
		<>
			<div className="flex items-center gap-1">
				<Button
					variant="secondary"
					size="sm"
					aria-label={t("edellinenJakso", "Edellinen jakso")}
					onClick={() =>
						onChange({ start_date: shiftPeriod(start, months, -1) })
					}
				>
					<ChevronLeft size={16} />
				</Button>

				<input
					type="date"
					aria-label={t("jaksonAlku", "Jakson alku")}
					value={formatYYYYMMDD(start)}
					// The input value is already YYYY-MM-DD; valueAsDate would be UTC midnight
					onChange={(e) =>
						e.target.value && onChange({ start_date: e.target.value })
					}
					className="px-2.5 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-mono"
				/>

				<Button
					variant="secondary"
					size="sm"
					aria-label={t("seuraavaJakso", "Seuraava jakso")}
					onClick={() =>
						onChange({ start_date: shiftPeriod(start, months, 1) })
					}
				>
					<ChevronRight size={16} />
				</Button>
			</div>

			<select
				aria-label={t("jaksonPituus", "Jakson pituus")}
				value={months}
				onChange={(e) =>
					onChange({ months: parsePeriodMonths(Number(e.target.value)) })
				}
				className="px-2.5 py-1 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-medium"
			>
				<option value={1}>{t("1Kuukausi", "1 kuukausi")}</option>
				<option value={3}>{t("3Kuukautta", "3 kuukautta")}</option>
				<option value={6}>{t("6Kuukautta", "6 kuukautta")}</option>
				<option value={12}>{t("1Vuosi", "1 vuosi")}</option>
			</select>
		</>
	);
}
