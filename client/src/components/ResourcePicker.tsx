import { Search, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "#/components/Input";
import { cn } from "#/utils/cn";
import { getCollectionIcon } from "#/utils/collectionIcons";

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
 * Multi-select for resources: selected ones as removable chips on top, the rest grouped by
 * collection with an optional search. Selection rules (exclusivity etc.) belong to the caller.
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

	const groups = useMemo(() => {
		const q = query.trim().toLowerCase();
		const matching = resources.filter(
			(r) => !q || r.name.toLowerCase().includes(q),
		);
		const result: {
			id: string;
			name: string;
			icon?: string | null;
			items: ResourcePickerResource[];
		}[] = [];
		for (const c of collections) {
			const items = matching.filter((r) => r.collection_id === c.id);
			if (items.length) result.push({ ...c, items });
		}
		const known = new Set(collections.map((c) => c.id));
		const others = matching.filter((r) => !known.has(r.collection_id));
		if (others.length) {
			result.push({
				id: "other",
				name: t("resurssiMuut", "Muut"),
				items: others,
			});
		}
		return result;
	}, [resources, collections, query, t]);

	const selected = value
		.map((id) => resources.find((r) => r.id === id))
		.filter((r): r is ResourcePickerResource => r !== undefined);

	return (
		<div className={cn("space-y-3", className)}>
			<ul
				aria-label={t("valitutResurssit", "Valitut resurssit")}
				className="m-0 flex min-h-8 list-none flex-wrap items-center gap-2 p-0"
			>
				{selected.length === 0 && (
					<li className="text-sm text-ink-muted">
						{t("eiValittujaResursseja", "Ei valittuja resursseja")}
					</li>
				)}
				{selected.map((r) => (
					<li key={r.id}>
						<button
							type="button"
							onClick={() => onToggle(r.id)}
							aria-label={t("poistaResurssiValinnasta", "Poista {{name}}", {
								name: r.name,
							})}
							className="focus-ring inline-flex cursor-pointer items-center gap-1.5 rounded-sm border border-stone-900 bg-stone-900 px-2.5 py-1 text-xs font-medium text-stone-50 dark:border-stone-200 dark:bg-stone-200 dark:text-stone-900"
						>
							{r.name}
							<X size={12} aria-hidden="true" />
						</button>
					</li>
				))}
			</ul>

			{showSearch && (
				<div className="relative">
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
						className="pl-8"
					/>
				</div>
			)}

			<div className="max-h-80 space-y-3 overflow-y-auto rounded-md border border-line p-2">
				{groups.length === 0 && (
					<p className="px-1 py-2 text-sm text-ink-muted">
						{t("eiHakutuloksia", "Ei hakutuloksia")}
					</p>
				)}
				{groups.map((group) => {
					const Icon = getCollectionIcon(group.icon);
					return (
						<fieldset
							key={group.id}
							className="m-0 min-w-0 space-y-1 border-0 p-0"
						>
							<legend className="float-left flex w-full items-center gap-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">
								<Icon size={14} aria-hidden="true" />
								{group.name}
							</legend>
							<div className="clear-both grid gap-1 sm:grid-cols-2">
								{group.items.map((r) => {
									const checked = value.includes(r.id);
									const hints = [
										r.auto_confirm &&
											t(
												"vahvistuuAutomaattisesti",
												"Vahvistuu automaattisesti",
											),
										r.blocks_only &&
											t("vainVarausjaksotLyhyt", "Vain varausjaksot"),
										r.reservation_restricted &&
											t("rajattuRyhmille", "Rajattu ryhmille"),
									].filter(Boolean);
									return (
										<label
											key={r.id}
											className={cn(
												"flex min-h-11 cursor-pointer items-start gap-2 rounded-md border px-2.5 py-2 text-sm transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-purple-500",
												checked
													? "border-stone-900 bg-surface-muted dark:border-stone-200"
													: "border-transparent hover:bg-surface-muted",
											)}
										>
											<input
												type="checkbox"
												checked={checked}
												onChange={() => onToggle(r.id)}
												className="mt-0.5 size-4 shrink-0 cursor-pointer accent-stone-900 dark:accent-stone-200"
											/>
											<span className="min-w-0">
												<span className="block break-words font-medium">
													{r.name}
												</span>
												{hints.length > 0 && (
													<span className="block text-xs text-ink-muted">
														{hints.join(" · ")}
													</span>
												)}
											</span>
										</label>
									);
								})}
							</div>
						</fieldset>
					);
				})}
			</div>
		</div>
	);
}
