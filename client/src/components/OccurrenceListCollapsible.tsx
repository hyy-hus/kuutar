import { ChevronDown, ChevronUp } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { DetachOccurrenceButton } from "#/components/DetachOccurrenceButton";
import { useDateFormatter } from "#/utils/date";

export interface OccurrenceListItem {
	id: string;
	/** ISO timestamp */
	start_time: string;
	/** ISO timestamp */
	end_time: string;
	/** Group heading, usually the resource name. Items with the same label are grouped. */
	groupLabel: string;
	/** Shows a "Varattu" chip */
	reserved?: boolean;
	/** Shows the "Irrota sarjasta" button; only set for admins when the item can be split */
	canDetach?: boolean;
}

export interface OccurrenceListCollapsibleProps {
	items: OccurrenceListItem[];
	/** Called after the user confirms detaching one occurrence from its series */
	onDetach?: (id: string) => Promise<void>;
	detachDisabled?: boolean;
	/** Rows shown per group before "Näytä kaikki n" (default 5) */
	initialVisible?: number;
}

/**
 * Occurrences grouped by resource. Each group shows the first `initialVisible` rows and
 * expands with "Näytä kaikki n". Written for blocks and restrictions (P7); meant to be
 * unified with the reservation occurrence list later.
 */
export function OccurrenceListCollapsible({
	items,
	onDetach,
	detachDisabled,
	initialVisible = 5,
}: OccurrenceListCollapsibleProps) {
	const groups = useMemo(() => {
		const map = new Map<string, OccurrenceListItem[]>();
		for (const item of [...items].sort((a, b) =>
			a.start_time.localeCompare(b.start_time),
		)) {
			map.set(item.groupLabel, [...(map.get(item.groupLabel) ?? []), item]);
		}
		return Array.from(map, ([label, groupItems]) => ({ label, groupItems }));
	}, [items]);

	return (
		<div className="space-y-4">
			{groups.map((group) => (
				<OccurrenceGroup
					key={group.label}
					label={group.label}
					items={group.groupItems}
					showLabel={groups.length > 1 || group.label !== ""}
					onDetach={onDetach}
					detachDisabled={detachDisabled}
					initialVisible={initialVisible}
				/>
			))}
		</div>
	);
}

function OccurrenceGroup({
	label,
	items,
	showLabel,
	onDetach,
	detachDisabled,
	initialVisible,
}: {
	label: string;
	items: OccurrenceListItem[];
	showLabel: boolean;
	onDetach?: (id: string) => Promise<void>;
	detachDisabled?: boolean;
	initialVisible: number;
}) {
	const { t } = useTranslation();
	const { formatRange } = useDateFormatter();
	const [expanded, setExpanded] = useState(false);
	const collapsible = items.length > initialVisible;
	const visible = expanded ? items : items.slice(0, initialVisible);

	return (
		<section className="space-y-2">
			{showLabel && (
				<h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
					{label}{" "}
					<span className="text-xs font-normal text-stone-600 dark:text-stone-400">
						({items.length})
					</span>
				</h3>
			)}
			<ul className="divide-y divide-stone-300 rounded-md border border-stone-300 bg-stone-50 dark:divide-stone-700 dark:border-stone-700 dark:bg-stone-900">
				{visible.map((item) => (
					<li
						key={item.id}
						className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
					>
						<span className="tabular-nums">
							{formatRange(item.start_time, item.end_time)}
						</span>
						<span className="flex items-center gap-2">
							{item.reserved && <Chip>{t("varattu", "Varattu")}</Chip>}
							{item.canDetach && onDetach && (
								<DetachOccurrenceButton
									onDetach={() => onDetach(item.id)}
									disabled={detachDisabled}
								/>
							)}
						</span>
					</li>
				))}
			</ul>
			{collapsible && (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					aria-expanded={expanded}
					onClick={() => setExpanded((v) => !v)}
				>
					{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
					{expanded
						? t("naytaVahemman", "Näytä vähemmän")
						: t("naytaKaikkiN", "Näytä kaikki {{count}}", {
								count: items.length,
							})}
				</Button>
			)}
		</section>
	);
}
