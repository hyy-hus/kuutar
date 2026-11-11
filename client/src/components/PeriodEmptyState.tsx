import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { EmptyState, type EmptyStateProps } from "#/components/EmptyState";
import { formatYYYYMMDD, useDateFormatter } from "#/utils/date";
import {
	getPeriodRange,
	PERIOD_MONTHS,
	type PeriodMonths,
} from "#/utils/period";

interface PeriodEmptyStateProps extends Pick<EmptyStateProps, "icon"> {
	/** Start of the period being shown (the page's `start`) */
	start: Date;
	months: PeriodMonths;
	/** What was looked for, in the partitive: "varauksia", "aikarajoituksia", ... */
	what: string;
	onChange: (next: { months: PeriodMonths }) => void;
	/** Extra action next to "show longer period", e.g. "New reservation" */
	action?: React.ReactNode;
}

/**
 * Empty result of a list that only looks at a time frame: says that nothing was found in
 * that frame (with the dates) and offers to look further ahead.
 */
export function PeriodEmptyState({
	start,
	months,
	what,
	onChange,
	icon,
	action,
}: PeriodEmptyStateProps) {
	const { t } = useTranslation();
	const { formatDateOnly } = useDateFormatter();
	const { endDateISO } = getPeriodRange(formatYYYYMMDD(start), months);
	const range = `${formatDateOnly(start)}–${formatDateOnly(endDateISO)}`;

	const labels: Record<PeriodMonths, string> = {
		1: t("1Kuukausi", "1 kuukausi"),
		3: t("3Kuukautta", "3 kuukautta"),
		6: t("6Kuukautta", "6 kuukautta"),
		12: t("1Vuosi", "1 vuosi"),
	};
	const longer = PERIOD_MONTHS.find((m) => m > months);

	return (
		<EmptyState
			icon={icon}
			title={t("eiTuloksiaAikavalilla", "Ei {{what}} aikavälillä {{range}}", {
				what,
				range,
			})}
			action={
				longer || action ? (
					<div className="flex flex-wrap justify-center gap-2">
						{longer && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => onChange({ months: longer })}
							>
								{t("naytaPidempiJakso", "Näytä {{period}}", {
									period: labels[longer],
								})}
							</Button>
						)}
						{action}
					</div>
				) : undefined
			}
		>
			{longer
				? t(
						"kokeilePidempaaJaksoa",
						"Vain valittu aikaväli on haettu. Kokeile pidempää jaksoa tai siirrä sitä nuolilla.",
					)
				: t(
						"siirraAikavalia",
						"Pisin jakso on jo käytössä. Siirrä aikaväliä nuolilla.",
					)}
		</EmptyState>
	);
}
