import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import type { Round } from "#/hooks/useRounds";
import { useDateFormatter } from "#/utils/date";
import { roundPhase, roundPreselection } from "#/utils/rounds";

interface RoundNoticeProps {
	round: Round;
	/** Defaults to the current time; set in stories and tests */
	now?: Date;
}

/**
 * Tells a member that a round they can take part in is open, and what to do: a booking of a
 * round resource in the round's period is an application, not a reservation. Upcoming rounds
 * render nothing; admins announce them separately.
 */
export function RoundNotice({ round, now }: RoundNoticeProps) {
	const { t } = useTranslation();
	const { formatDateTime, formatDateOnly } = useDateFormatter();
	const phase = roundPhase(round, now);
	if (phase === "completed" || phase === "upcoming") return null;

	const period = `${formatDateOnly(round.period_start)} – ${formatDateOnly(round.period_end)}`;
	const openRound = (
		<Button variant="outline" size="sm" asChild>
			<Link to="/reservations/rounds/$id" params={{ id: round.id }}>
				<span>{t("avaaKierros", "Avaa kierros")}</span>
				<ChevronRight size={16} aria-hidden="true" />
			</Link>
		</Button>
	);

	if (phase === "open") {
		return (
			<Callout
				variant="info"
				title={round.name}
				action={
					<div className="flex flex-wrap gap-2">
						<Button size="sm" asChild>
							<Link
								to="/reservations/create"
								search={{ resource_ids: roundPreselection(round) }}
							>
								{t("haeVarausjaksoa", "Hae varausjaksoa")}
							</Link>
						</Button>
						{openRound}
					</div>
				}
			>
				{t(
					"kierrosIlmoitusAuki",
					"Haku on käynnissä {{end}} asti. Valitse resurssi ja haluamasi varausjakso ajalta {{period}}: jokainen valittu jakso on yksi hakemus, ja voit hakea enintään {{max}} jaksoa kutakin resurssia kohden. Päätös tulee sähköpostiin haun päätyttyä.",
					{
						end: formatDateTime(round.applications_close_at),
						period,
						max: round.max_pending_per_resource,
					},
				)}
			</Callout>
		);
	}

	return (
		<Callout variant="info" title={round.name} action={openRound}>
			{t(
				"kierrosIlmoitusJaossa",
				"Haku on päättynyt. Hakemukset jaetaan, ja päätös tulee sähköpostiin.",
			)}
		</Callout>
	);
}
