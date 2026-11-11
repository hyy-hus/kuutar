import { ChevronDown, ChevronUp } from "lucide-react";
import { type ReactNode, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateFormatter } from "#/utils/date";
import { Button } from "./Button";

export interface OccurrenceListItem {
	id: string;
	start_time: string;
	end_time: string;
	/** Occurrences are grouped by this id; omit for a single ungrouped list */
	resource_id?: string | null;
}

export interface OccurrenceListProps<T extends OccurrenceListItem> {
	occurrences: T[];
	/** Group heading by `resource_id`; falls back to the id. Not needed without resource ids. */
	resourceNames?: Map<string, string> | Record<string, string>;
	/**
	 * Per-row action, shown on hover/focus (always on touch screens). Return null for rows
	 * that have none, e.g. `<DetachOccurrenceButton />` when the row can be split off.
	 */
	renderAction?: (occurrence: T) => ReactNode;
	/** Rows shown before "Show all n"; default 5 */
	collapseAfter?: number;
}

/**
 * Occurrences (times of a reservation, block or restriction) grouped by resource, each
 * group collapsed beyond `collapseAfter` rows. Dates are shown once per row via `formatRange`.
 */
export function OccurrenceList<T extends OccurrenceListItem>({
	occurrences,
	resourceNames,
	renderAction,
	collapseAfter = 5,
}: OccurrenceListProps<T>) {
	const groups = useMemo(() => {
		const byResource = new Map<string, T[]>();
		for (const occ of occurrences) {
			const key = occ.resource_id ?? "";
			byResource.set(key, [...(byResource.get(key) ?? []), occ]);
		}
		return [...byResource.entries()].map(([resourceId, items]) => ({
			resourceId,
			items: [...items].sort((a, b) =>
				a.start_time.localeCompare(b.start_time),
			),
		}));
	}, [occurrences]);

	const nameOf = (id: string) =>
		(resourceNames instanceof Map
			? resourceNames.get(id)
			: (resourceNames as Record<string, string> | undefined)?.[id]) ?? id;

	return (
		<div className="space-y-4">
			{groups.map((group) => (
				<OccurrenceGroup
					key={group.resourceId}
					title={group.resourceId ? nameOf(group.resourceId) : undefined}
					items={group.items}
					renderAction={renderAction}
					collapseAfter={collapseAfter}
				/>
			))}
		</div>
	);
}

function OccurrenceGroup<T extends OccurrenceListItem>({
	title,
	items,
	renderAction,
	collapseAfter,
}: {
	title?: string;
	items: T[];
	renderAction?: (occurrence: T) => ReactNode;
	collapseAfter: number;
}) {
	const { t } = useTranslation();
	const { formatRange } = useDateFormatter();
	const [expanded, setExpanded] = useState(false);
	const canCollapse = items.length > collapseAfter;
	const shown =
		canCollapse && !expanded ? items.slice(0, collapseAfter) : items;

	return (
		<div className="space-y-1">
			{title && (
				<h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
					{title}
					<span className="ml-2 text-xs font-normal text-stone-600 dark:text-stone-400">
						{items.length}
					</span>
				</h3>
			)}
			<ul className="divide-y divide-stone-200 rounded-md border border-stone-300 bg-stone-50 dark:divide-stone-800 dark:border-stone-700 dark:bg-stone-900">
				{shown.map((occ) => {
					const action = renderAction?.(occ);
					return (
						<li
							key={occ.id}
							className="group/row flex min-h-10 items-center justify-between gap-2 px-3 py-1 text-sm tabular-nums text-stone-900 dark:text-stone-100"
						>
							<span>{formatRange(occ.start_time, occ.end_time)}</span>
							{action && (
								<span className="shrink-0 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover/row:opacity-100">
									{action}
								</span>
							)}
						</li>
					);
				})}
			</ul>
			{canCollapse && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-expanded={expanded}
					onClick={() => setExpanded((value) => !value)}
				>
					{expanded ? (
						<ChevronUp size={14} aria-hidden="true" />
					) : (
						<ChevronDown size={14} aria-hidden="true" />
					)}
					{expanded
						? t("naytaVahemman", "Näytä vähemmän")
						: t("naytaKaikkiN", "Näytä kaikki {{count}}", {
								count: items.length,
							})}
				</Button>
			)}
		</div>
	);
}
