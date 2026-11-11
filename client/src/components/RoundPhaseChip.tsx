import { CalendarClock, CheckCircle2, Hourglass, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusChip } from "#/components/StatusChip";
import type { Round } from "#/hooks/useRounds";
import { type RoundPhase, roundPhase } from "#/utils/rounds";

/** Order for listing rounds: the ones that need attention first */
export const PHASE_ORDER: Record<RoundPhase, number> = {
	open: 0,
	allocating: 1,
	upcoming: 2,
	completed: 3,
};

export function RoundPhaseChip({ round }: { round: Round }) {
	const { t } = useTranslation();
	const phase = roundPhase(round);
	switch (phase) {
		case "open":
			return (
				<StatusChip variant="success" icon={CheckCircle2}>
					{t("kierrosAvoinna", "Haku käynnissä")}
				</StatusChip>
			);
		case "allocating":
			return (
				<StatusChip variant="warning" icon={Hourglass}>
					{t("kierrosJaossa", "Odottaa jakoa")}
				</StatusChip>
			);
		case "upcoming":
			return (
				<StatusChip variant="neutral" icon={CalendarClock}>
					{t("kierrosTulossa", "Tulossa")}
				</StatusChip>
			);
		default:
			return (
				<StatusChip variant="neutral" icon={Lock}>
					{t("kierrosPttynyt", "Päättynyt")}
				</StatusChip>
			);
	}
}
