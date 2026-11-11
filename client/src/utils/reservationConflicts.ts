/** Minimal shape needed to detect clashes; ReservationWithOccurrences satisfies it */
export interface ConflictReservation {
	id: string;
	status: string;
	occurrences?: {
		resource_id: string;
		start_time: string;
		end_time: string;
	}[];
}

/** Occurrence of `b` that overlaps one of `a` on the same resource, if any */
export function overlappingOccurrence<B extends ConflictReservation>(
	a: ConflictReservation,
	b: B,
): NonNullable<B["occurrences"]>[number] | undefined {
	if (a.id === b.id) return undefined;
	const aOccs = a.occurrences ?? [];
	return (b.occurrences ?? []).find((y) =>
		aOccs.some(
			(x) =>
				x.resource_id === y.resource_id &&
				new Date(x.start_time).getTime() < new Date(y.end_time).getTime() &&
				new Date(x.end_time).getTime() > new Date(y.start_time).getTime(),
		),
	);
}

/** True when two reservations occupy the same resource at overlapping times */
export function reservationsOverlap(
	a: ConflictReservation,
	b: ConflictReservation,
): boolean {
	return overlappingOccurrence(a, b) !== undefined;
}

/**
 * For every pending reservation, the other live (pending or confirmed) reservations it
 * overlaps on the same resource. Reservations without conflicts are not in the map.
 */
export function findConflicts<T extends ConflictReservation>(
	pending: T[],
	all: T[],
): Map<string, T[]> {
	const live = all.filter(
		(r) => r.status === "pending" || r.status === "confirmed",
	);
	const result = new Map<string, T[]>();
	for (const p of pending) {
		const others = live.filter((o) => reservationsOverlap(p, o));
		if (others.length > 0) result.set(p.id, others);
	}
	return result;
}
