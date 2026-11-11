import { Search } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleChip } from "#/components/Chip";
import { Input } from "#/components/Input";
import { cn } from "#/utils/cn";

export interface ResourcePickerResource {
	id: string;
	name: string;
	collection_id: string;
	collection_icon?: string | null;
	auto_confirm?: boolean;
	blocks_only?: boolean;
	reservation_restricted?: boolean;
}

export interface ResourcePickerCollection {
	id: string;
	name: string;
	icon?: string | null;
}

export interface ResourcePickerProps {
	/** Resources the user may pick (already filtered by the caller) */
	resources: ResourcePickerResource[];
	collections: ResourcePickerCollection[];
	/** Selected resource ids */
	value: string[];
	/** Called with a resource id to select it or, when already selected, to remove it */
	onToggle: (id: string) => void;
	/** Search field is shown above this many resources */
	searchThreshold?: number;
	className?: string;
}

/**
 * Multi-select for resources: one row of toggle chips (ordered by collection) with a search
 * field when there are many. Selected chips stay visible while searching. Selection rules
 * (exclusivity etc.) belong to the caller.
 */
export function ResourcePicker({
	resources,
	collections,
	value,
	onToggle,
	searchThreshold = 8,
	className,
}: ResourcePickerProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");
	const searchId = useId();
	const showSearch = resources.length > searchThreshold;

	const visible = useMemo(() => {
		const order = new Map(collections.map((c, i) => [c.id, i]));
		const rank = (r: ResourcePickerResource) =>
			order.get(r.collection_id) ?? collections.length;
		const q = query.trim().toLowerCase();
		return resources
			.map((r, index) => ({ r, index }))
			.sort((a, b) => rank(a.r) - rank(b.r) || a.index - b.index)
			.map(({ r }) => r)
			.filter(
				(r) => !q || r.name.toLowerCase().includes(q) || value.includes(r.id),
			);
	}, [resources, collections, query, value]);

	const hintFor = (r: ResourcePickerResource) =>
		[
			r.auto_confirm &&
				t("vahvistuuAutomaattisesti", "Vahvistuu automaattisesti"),
			r.blocks_only && t("vainVarausjaksotLyhyt", "Vain varausjaksot"),
			r.reservation_restricted && t("rajattuRyhmille", "Rajattu ryhmille"),
		]
			.filter(Boolean)
			.join(" · ");

	return (
		<div className={cn("space-y-2", className)}>
			{showSearch && (
				<div className="relative max-w-xs">
					<Search
						size={14}
						aria-hidden="true"
						className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
					/>
					<Input
						id={searchId}
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("haeResursseja", "Hae resursseja")}
						aria-label={t("haeResursseja", "Hae resursseja")}
						className="h-9 pl-8"
					/>
				</div>
			)}
			<ul
				aria-label={t("resurssit", "Resurssit")}
				className="m-0 flex list-none flex-wrap gap-2 p-0"
			>
				{visible.map((r) => (
					<li key={r.id}>
						<ToggleChip
							selected={value.includes(r.id)}
							onClick={() => onToggle(r.id)}
							title={hintFor(r) || undefined}
							className="h-8 px-3 text-sm"
						>
							{r.name}
						</ToggleChip>
					</li>
				))}
				{visible.length === 0 && (
					<li className="text-sm text-ink-muted">
						{t("eiHakutuloksia", "Ei hakutuloksia")}
					</li>
				)}
			</ul>
		</div>
	);
}
