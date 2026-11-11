import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { DateInput } from "#/components/DateInput";
import { Select } from "#/components/Select";
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

/** Previous/next arrows, a start date picker and a period length selector; place inside `FilterBar` */
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
					variant="outline"
					size="iconSm"
					aria-label={t("edellinenJakso", "Edellinen jakso")}
					title={t("edellinenJakso", "Edellinen jakso")}
					onClick={() =>
						onChange({ start_date: shiftPeriod(start, months, -1) })
					}
				>
					<ChevronLeft size={16} />
				</Button>

				<DateInput
					size="sm"
					aria-label={t("jaksonAlku", "Jakson alku")}
					value={formatYYYYMMDD(start)}
					// The input value is already YYYY-MM-DD; valueAsDate would be UTC midnight
					onChange={(e) =>
						e.target.value && onChange({ start_date: e.target.value })
					}
					className="w-auto tabular-nums"
				/>

				<Button
					variant="outline"
					size="iconSm"
					aria-label={t("seuraavaJakso", "Seuraava jakso")}
					title={t("seuraavaJakso", "Seuraava jakso")}
					onClick={() =>
						onChange({ start_date: shiftPeriod(start, months, 1) })
					}
				>
					<ChevronRight size={16} />
				</Button>
			</div>

			<Select
				size="sm"
				wrapperClassName="w-auto"
				aria-label={t("jaksonPituus", "Jakson pituus")}
				value={months}
				onChange={(e) =>
					onChange({ months: parsePeriodMonths(Number(e.target.value)) })
				}
			>
				<option value={1}>{t("1Kuukausi", "1 kuukausi")}</option>
				<option value={3}>{t("3Kuukautta", "3 kuukautta")}</option>
				<option value={6}>{t("6Kuukautta", "6 kuukautta")}</option>
				<option value={12}>{t("1Vuosi", "1 vuosi")}</option>
			</Select>
		</>
	);
}
