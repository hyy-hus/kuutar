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
	externally_taken?: boolean;
};

const sameSlot = (
	a: { resource_id: string; start_time: string },
	b: { resource_id: string; start_time: string },
) =>
	a.resource_id === b.resource_id &&
	new Date(a.start_time).getTime() === new Date(b.start_time).getTime();

/**
 * Picks which of a user's applications for a resource is granted in an allocation draft
 * (or none, with null). A user gets at most one block per resource, so the others for
 * that user and resource are dropped.
 */
export function selectApplication(
	granted: readonly string[],
	applications: readonly SlotApplication[],
	userId: string,
	resourceId: string,
	reservationId: string | null,
): string[] {
	const theirs = new Set(
		applications
			.filter((a) => a.user_id === userId && a.resource_id === resourceId)
			.map((a) => a.reservation_id),
	);
	const kept = granted.filter((id) => !theirs.has(id));
	return reservationId ? [...kept, reservationId] : kept;
}

export type SlotConflict = {
	/** Other granted applications holding the very same block */
	sharedWith: string[];
	/** The block is held by a reservation outside the round */
	externallyTaken: boolean;
};

/** Granted applications that cannot all stand: shared blocks and externally taken blocks. */
export function findConflicts(
	granted: readonly string[],
	applications: readonly SlotApplication[],
): Map<string, SlotConflict> {
	const grantedApps = applications.filter((a) =>
		granted.includes(a.reservation_id),
	);
	const conflicts = new Map<string, SlotConflict>();
	for (const app of grantedApps) {
		const sharedWith = grantedApps
			.filter(
				(o) => o.reservation_id !== app.reservation_id && sameSlot(o, app),
			)
			.map((o) => o.reservation_id);
		const externallyTaken = app.externally_taken === true;
		if (sharedWith.length > 0 || externallyTaken) {
			conflicts.set(app.reservation_id, { sharedWith, externallyTaken });
		}
	}
	return conflicts;
}

/** Other applications for the same block. */
export function competingApplications<T extends SlotApplication>(
	app: T,
	applications: readonly T[],
): T[] {
	return applications.filter(
		(o) => o.reservation_id !== app.reservation_id && sameSlot(o, app),
	);
}
