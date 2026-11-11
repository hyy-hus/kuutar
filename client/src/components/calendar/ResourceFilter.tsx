import { Check, ChevronDown, Layers, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "#/utils/cn";
import { getCollectionIcon } from "#/utils/collectionIcons";
import {
	getContrastColor,
	getResourceColor,
	getResourceHex,
} from "#/utils/resourceColors";
import { useIsMobile } from "./useIsMobile";

export interface FilterResource {
	id: string;
	name: string;
	color?: string | null;
	collection_id: string;
}

export interface FilterCollection {
	id: string;
	name: string;
	icon?: string | null;
}

interface ResourceFilterProps {
	resources: FilterResource[];
	collections: FilterCollection[];
	selectedIds: string[];
	onChange: (ids: string[]) => void;
	/** Whether the panel starts open; narrow screens start collapsed */
	defaultOpen?: boolean;
	className?: string;
}

interface Group {
	id: string;
	name?: string;
	icon?: string | null;
	resources: FilterResource[];
}

/** Resources grouped by collection (collections by name); resources of unknown collections go last */
export function groupResources(
	resources: FilterResource[],
	collections: FilterCollection[],
): Group[] {
	const byCollection = new Map<string, FilterResource[]>();
	for (const res of resources) {
		const list = byCollection.get(res.collection_id) ?? [];
		list.push(res);
		byCollection.set(res.collection_id, list);
	}
	const groups: Group[] = [];
	for (const collection of [...collections].sort((a, b) =>
		a.name.localeCompare(b.name),
	)) {
		const list = byCollection.get(collection.id);
		if (list) {
			groups.push({ ...collection, resources: list });
			byCollection.delete(collection.id);
		}
	}
	const rest = [...byCollection.values()].flat();
	if (rest.length > 0) groups.push({ id: "other", resources: rest });
	return groups;
}

/**
 * Collapsible resource filter for the calendar: a bar with the selection count that opens a
 * panel of chips grouped by collection. A selected chip is tinted in the resource's colour.
 */
export function ResourceFilter({
	resources,
	collections,
	selectedIds,
	onChange,
	defaultOpen = false,
	className,
}: ResourceFilterProps) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(defaultOpen);
	const panelId = useId();
	const groups = useMemo(
		() => groupResources(resources, collections),
		[resources, collections],
	);
	const selected = new Set(selectedIds);
	const selectedResources = resources.filter((r) => selected.has(r.id));
	const selectedCount = selectedResources.length;
	const isMobile = useIsMobile();
	// Few enough chips to stay within two lines; the rest collapses into a "+N" chip
	const maxChips = isMobile ? 3 : 8;
	const shownChips = selectedResources.slice(0, maxChips);
	const hiddenCount = selectedCount - shownChips.length;
	const allSelected =
		resources.length > 0 && selectedCount === resources.length;

	const setGroup = (group: Group, on: boolean) => {
		const ids = new Set(group.resources.map((r) => r.id));
		const rest = selectedIds.filter((id) => !ids.has(id));
		onChange(on ? [...rest, ...ids] : rest);
	};
	const toggle = (id: string) =>
		onChange(
			selected.has(id)
				? selectedIds.filter((x) => x !== id)
				: [...selectedIds, id],
		);

	const quick =
		"focus-ring rounded-sm px-1.5 py-0.5 text-xs font-medium text-accent underline-offset-2 hover:underline cursor-pointer";

	return (
		<div
			className={cn(
				"rounded-md border border-stone-300 dark:border-stone-700",
				className,
			)}
		>
			<div className="flex items-center gap-1 pr-2">
				<button
					type="button"
					aria-expanded={open}
					aria-controls={panelId}
					onClick={() => setOpen((o) => !o)}
					className="focus-ring flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md px-3 text-sm font-medium hover:bg-stone-100 dark:hover:bg-stone-900"
				>
					<Layers size={16} aria-hidden="true" />
					<span>{t("resurssit", "Resurssit")}</span>
					<ChevronDown
						size={16}
						aria-hidden="true"
						className={cn("ml-auto transition-transform", open && "rotate-180")}
					/>
				</button>
				{resources.length > 0 && (
					<button
						type="button"
						className={quick}
						onClick={() =>
							onChange(allSelected ? [] : resources.map((r) => r.id))
						}
					>
						{allSelected
							? t("tyhjenna", "Tyhjennä")
							: t("valitseKaikki", "Valitse kaikki")}
					</button>
				)}
			</div>

			<div
				data-testid="resource-summary"
				className="flex flex-wrap items-center gap-1.5 px-3 pb-2"
			>
				{allSelected ? (
					<span className="text-sm font-medium">
						{t("kaikkiResurssitMaara", "Kaikki resurssit ({{count}})", {
							count: resources.length,
						})}
					</span>
				) : selectedCount === 0 ? (
					<span className="text-xs text-stone-600 dark:text-stone-400">
						{t(
							"kalenteriEiValittujaResursseja",
							"Ei resursseja valittuna. Avaa lista ja valitse näytettävät resurssit.",
						)}
					</span>
				) : (
					<>
						{shownChips.map((res) => (
							<SelectedChip
								key={res.id}
								resource={res}
								onRemove={() =>
									onChange(selectedIds.filter((x) => x !== res.id))
								}
							/>
						))}
						{hiddenCount > 0 && (
							<button
								type="button"
								aria-expanded={open}
								aria-controls={panelId}
								aria-label={t(
									"naytaKaikkiValitut",
									"Näytä kaikki valitut resurssit (+{{count}})",
									{ count: hiddenCount },
								)}
								onClick={() => setOpen(true)}
								className="focus-ring cursor-pointer rounded-sm border border-stone-300 px-2 py-1 text-xs font-medium tabular-nums hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-900"
							>
								{`+${hiddenCount}`}
							</button>
						)}
					</>
				)}
			</div>

			{open && (
				<div
					id={panelId}
					className="space-y-3 border-t border-stone-300 p-3 dark:border-stone-700"
				>
					<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
						<p className="text-xs text-stone-600 dark:text-stone-400">
							{t(
								"resurssiSuodatinOhje",
								"Valitse näytettävät resurssit. Kaksoisnapsauta tai Ctrl-napsauta nimeä näyttääksesi vain sen.",
							)}
						</p>
						<span className="ml-auto flex gap-1">
							<button
								type="button"
								className={quick}
								onClick={() => onChange(resources.map((r) => r.id))}
							>
								{t("kaikki", "Kaikki")}
							</button>
							<button
								type="button"
								className={quick}
								onClick={() => onChange([])}
							>
								{t("eiYhtaan", "Ei yhtään")}
							</button>
						</span>
					</div>

					{groups.map((group) => {
						const Icon = getCollectionIcon(group.icon);
						const headingId = `${panelId}-${group.id}`;
						return (
							<fieldset
								key={group.id}
								aria-labelledby={headingId}
								className="min-w-0 space-y-1.5"
							>
								<div className="flex flex-wrap items-center gap-x-2">
									<h3
										id={headingId}
										className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-300"
									>
										<Icon size={14} aria-hidden="true" />
										{group.name ?? t("muut", "Muut")}
									</h3>
									<button
										type="button"
										className={quick}
										aria-label={`${t("kaikki", "Kaikki")}: ${group.name ?? t("muut", "Muut")}`}
										onClick={() => setGroup(group, true)}
									>
										{t("kaikki", "Kaikki")}
									</button>
									<button
										type="button"
										className={quick}
										aria-label={`${t("eiYhtaan", "Ei yhtään")}: ${group.name ?? t("muut", "Muut")}`}
										onClick={() => setGroup(group, false)}
									>
										{t("eiYhtaan", "Ei yhtään")}
									</button>
								</div>
								<div className="flex flex-wrap gap-1.5">
									{group.resources.map((res) => (
										<ResourceChip
											key={res.id}
											resource={res}
											selected={selected.has(res.id)}
											onToggle={() => toggle(res.id)}
											onSolo={() => onChange([res.id])}
										/>
									))}
								</div>
							</fieldset>
						);
					})}
				</div>
			)}
		</div>
	);
}

function ResourceChip({
	resource,
	selected,
	onToggle,
	onSolo,
}: {
	resource: FilterResource;
	selected: boolean;
	onToggle: () => void;
	onSolo: () => void;
}) {
	const { t } = useTranslation();
	const hex = getResourceHex(resource.color);
	const color = getResourceColor(resource.color);
	return (
		<button
			type="button"
			aria-pressed={selected}
			title={t(
				"vainTamaOhje",
				"Kaksoisnapsauta tai Ctrl-napsauta näyttääksesi vain tämän",
			)}
			onClick={(e) =>
				e.ctrlKey || e.metaKey || e.shiftKey ? onSolo() : onToggle()
			}
			onDoubleClick={onSolo}
			className={cn(
				"focus-ring inline-flex cursor-pointer select-none items-center gap-1.5 rounded-sm border px-2 py-1 text-xs font-medium transition-colors",
				selected
					? cn(
							"text-stone-900 dark:text-stone-100",
							color?.tint ?? "bg-stone-200 dark:bg-stone-800",
						)
					: "border-stone-300 bg-transparent text-stone-600 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-400 dark:hover:bg-stone-900",
			)}
			style={{
				...color?.style,
				...(selected ? { borderColor: hex } : {}),
			}}
		>
			<span
				aria-hidden="true"
				className={cn(
					"inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border-2",
				)}
				style={{
					color: getContrastColor(hex),
					borderColor: hex,
					backgroundColor: selected ? hex : "transparent",
				}}
			>
				{selected && <Check size={9} strokeWidth={4} />}
			</span>
			{resource.name}
		</button>
	);
}

/** Compact chip in the collapsed bar: colour dot, name and a button that deselects the resource */
function SelectedChip({
	resource,
	onRemove,
}: {
	resource: FilterResource;
	onRemove: () => void;
}) {
	const { t } = useTranslation();
	const hex = getResourceHex(resource.color);
	return (
		<span className="inline-flex max-w-[calc(50%-0.25rem)] items-center gap-1.5 rounded-sm border border-stone-300 bg-stone-50 py-0.5 pr-0.5 pl-2 text-xs font-medium sm:max-w-56 dark:border-stone-700 dark:bg-stone-900">
			<span
				aria-hidden="true"
				className="size-2.5 shrink-0 rounded-full"
				style={{ backgroundColor: hex }}
			/>
			<span className="truncate">{resource.name}</span>
			<button
				type="button"
				aria-label={t("poistaValinta", "Poista valinta: {{name}}", {
					name: resource.name,
				})}
				onClick={onRemove}
				className="focus-ring inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm hover:bg-stone-200 dark:hover:bg-stone-800"
			>
				<X size={12} aria-hidden="true" />
			</button>
		</span>
	);
}
