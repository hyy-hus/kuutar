export type RoundPhase = "upcoming" | "open" | "allocating" | "completed";

type RoundTimes = {
	status: "active" | "completed";
	applications_open_at: string;
	applications_close_at: string;
};

/** Mirrors the server's phase derivation, for showing a live phase without a refetch. */
export function roundPhase(
	round: RoundTimes,
	now: Date = new Date(),
): RoundPhase {
	if (round.status === "completed") return "completed";
	if (now < new Date(round.applications_open_at)) return "upcoming";
	if (now < new Date(round.applications_close_at)) return "open";
	return "allocating";
}

/** How many more applications the user may still make for one resource. */
export function remainingApplications(
	max: number,
	pendingForResource: number,
): number {
	return Math.max(0, max - pendingForResource);
}

/** Moves the item at `index` by `delta` positions, returning a new array. */
export function moveItem<T>(
	items: readonly T[],
	index: number,
	delta: -1 | 1,
): T[] {
	const target = index + delta;
	if (
		index < 0 ||
		index >= items.length ||
		target < 0 ||
		target >= items.length
	) {
		return [...items];
	}
	const next = [...items];
	[next[index], next[target]] = [next[target], next[index]];
	return next;
}

export type SlotApplication = {
	reservation_id: string;
	user_id: string;
	resource_id: string;
	start_time: string;
};

/**
 * Sets who holds a slot in an allocation draft: removes any other grant for the same
 * (resource, start) and adds `reservationId` (or just clears the slot when null).
 */
export function assignSlot(
	granted: readonly string[],
	applications: readonly SlotApplication[],
	slot: { resource_id: string; start_time: string },
	reservationId: string | null,
): string[] {
	const sameSlot = new Set(
		applications
			.filter(
				(a) =>
					a.resource_id === slot.resource_id &&
					new Date(a.start_time).getTime() ===
						new Date(slot.start_time).getTime(),
			)
			.map((a) => a.reservation_id),
	);
	const kept = granted.filter((id) => !sameSlot.has(id));
	return reservationId ? [...kept, reservationId] : kept;
}
