interface TimedOccurrence {
	start_time: string;
	end_time: string;
}

interface ReservationWithTimes<O extends TimedOccurrence> {
	status: string;
	occurrences?: O[] | null;
}

/**
 * Active reservations that haven't ended by `now`, soonest first, each with its next occurrence.
 * An occurrence in progress still counts as the next one.
 */
export function upcomingReservations<
	O extends TimedOccurrence,
	R extends ReservationWithTimes<O>,
>(reservations: R[], now: Date): { reservation: R; nextOccurrence: O }[] {
	const upcoming: { reservation: R; nextOccurrence: O; startMs: number }[] = [];

	for (const reservation of reservations) {
		if (reservation.status === "cancelled") continue;

		const remaining = (reservation.occurrences ?? [])
			.filter((o) => new Date(o.end_time).getTime() > now.getTime())
			.map((o) => ({
				occurrence: o,
				startMs: new Date(o.start_time).getTime(),
			}))
			.sort((a, b) => a.startMs - b.startMs);

		if (remaining.length > 0) {
			upcoming.push({
				reservation,
				nextOccurrence: remaining[0].occurrence,
				startMs: remaining[0].startMs,
			});
		}
	}

	return upcoming
		.sort((a, b) => a.startMs - b.startMs)
		.map(({ reservation, nextOccurrence }) => ({
			reservation,
			nextOccurrence,
		}));
}
