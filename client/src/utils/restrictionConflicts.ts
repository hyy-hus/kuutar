/** Minimal restriction shape; RestrictionWithOccurrences satisfies it */
export interface ConflictRestriction {
	title: string;
	exempt_group_ids: string[];
	occurrences?: {
		resource_id?: string | null;
		start_time: string;
		end_time: string;
	}[];
}

export interface ProposedOccurrence {
	resource_id: string;
	start_time: string;
	end_time: string;
}

export interface RestrictionConflict {
	title: string;
	start_time: string;
	end_time: string;
}

/**
 * Proposed occurrences that fall on a restricted period. Mirrors the server's
 * validate_occurrence_restrictions: a restriction without a resource applies to every
 * resource, and restrictions that exempt the user's group are skipped. Each
 * title/time pair is listed once, even when it overlaps on several resources.
 */
export function findRestrictionConflicts(
	proposed: ProposedOccurrence[],
	restrictions: ConflictRestriction[],
	userGroupId: string | undefined,
): RestrictionConflict[] {
	const applicable = restrictions.filter(
		(r) =>
			userGroupId === undefined || !r.exempt_group_ids.includes(userGroupId),
	);
	const found: RestrictionConflict[] = [];

	for (const p of proposed) {
		const pStart = new Date(p.start_time).getTime();
		const pEnd = new Date(p.end_time).getTime();
		const endISO = new Date(p.end_time).toISOString();

		for (const r of applicable) {
			const overlaps = (r.occurrences ?? []).some(
				(o) =>
					(!o.resource_id || o.resource_id === p.resource_id) &&
					pStart < new Date(o.end_time).getTime() &&
					pEnd > new Date(o.start_time).getTime(),
			);
			const isDuplicate = found.some(
				(f) =>
					f.title === r.title &&
					f.start_time === p.start_time &&
					f.end_time === endISO,
			);
			if (overlaps && !isDuplicate) {
				found.push({
					title: r.title,
					start_time: p.start_time,
					end_time: endISO,
				});
			}
		}
	}

	return found;
}
