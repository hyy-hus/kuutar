/** Who is allowed to do something with a resource */
export type Audience =
	| { kind: "everyone" }
	| { kind: "groups"; groupIds: string[] }
	| { kind: "admins" };

export type ConfirmMode =
	/** An admin must approve every reservation */
	| { kind: "approval" }
	/** Everyone who can reserve is confirmed immediately */
	| { kind: "everyone" }
	/** Only these groups are confirmed immediately; the rest need approval */
	| { kind: "groups"; groupIds: string[] };

export interface ResourceAccessInput {
	is_public: boolean;
	visibility_group_ids: string[];
	reservation_restricted: boolean;
	/** Groups allowed to reserve when `reservation_restricted` */
	reserve_group_ids: string[];
	auto_confirm: boolean;
	auto_confirm_group_ids: string[];
}

export interface ResourceAccessSummary {
	see: Audience;
	reserve: Audience;
	confirm: ConfirmMode;
}

const fromGroups = (groupIds: string[]): Audience =>
	groupIds.length > 0 ? { kind: "groups", groupIds } : { kind: "admins" };

/**
 * Turns the resource settings into the effective permissions, mirroring the server:
 * non-public resources are also visible to the groups that may reserve them, and
 * unrestricted resources can be reserved by everyone who can see them.
 */
export function summarizeResourceAccess(
	input: ResourceAccessInput,
): ResourceAccessSummary {
	const reserveGroups = input.reservation_restricted
		? input.reserve_group_ids
		: [];

	const see: Audience = input.is_public
		? { kind: "everyone" }
		: fromGroups([
				...new Set([...input.visibility_group_ids, ...reserveGroups]),
			]);

	const reserve: Audience = input.reservation_restricted
		? fromGroups(input.reserve_group_ids)
		: see;

	let confirm: ConfirmMode = { kind: "approval" };
	if (input.auto_confirm) {
		confirm =
			input.auto_confirm_group_ids.length > 0
				? { kind: "groups", groupIds: input.auto_confirm_group_ids }
				: { kind: "everyone" };
	}

	return { see, reserve, confirm };
}
