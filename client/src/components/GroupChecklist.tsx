import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Group } from "#/hooks/useGroups";
import { cn } from "#/utils/cn";

interface GroupChecklistProps {
	groups: Group[] | undefined;
	loading?: boolean;
	value: string[];
	onChange: (value: string[]) => void;
	className?: string;
	/** Tailwind classes for the checkbox accent */
	checkboxClassName?: string;
	/** Show the search field from this many groups upwards (default 8); `0` always shows it */
	searchThreshold?: number;
}

/** Scrollable checkbox list for picking a set of groups, with a search field for long lists */
export function GroupChecklist({
	groups,
	loading = false,
	value,
	onChange,
	className,
	checkboxClassName = "text-purple-600 focus:ring-purple-500",
	searchThreshold = 8,
}: GroupChecklistProps) {
	const { t } = useTranslation();
	const [query, setQuery] = useState("");

	if (loading) {
		return (
			<div className="py-2 text-xs text-stone-600 dark:text-stone-400">
				{t("ladataanRyhmia", "Ladataan ryhmiä...")}
			</div>
		);
	}

	const total = groups?.length ?? 0;
	const searchable = total >= searchThreshold;
	const needle = query.trim().toLowerCase();
	const visible = needle
		? (groups ?? []).filter((g) => g.name.toLowerCase().includes(needle))
		: (groups ?? []);

	return (
		<div
			className={cn(
				"overflow-hidden rounded-md border border-stone-400 bg-white dark:border-stone-600 dark:bg-stone-950",
				className,
			)}
		>
			{searchable && (
				<div className="flex items-center gap-2 border-b border-stone-300 px-2 dark:border-stone-700">
					<Search
						size={14}
						aria-hidden="true"
						className="shrink-0 text-stone-600 dark:text-stone-400"
					/>
					<input
						type="search"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("haeRyhmia", "Hae ryhmiä")}
						aria-label={t("haeRyhmia", "Hae ryhmiä")}
						className="h-8 min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-500 dark:text-stone-100 dark:placeholder:text-stone-400"
					/>
					<span className="shrink-0 text-xs tabular-nums text-stone-600 dark:text-stone-400">
						{t("valittuYhteensa", "{{selected}} / {{total}} valittu", {
							selected: value.length,
							total,
						})}
					</span>
				</div>
			)}
			<div className="max-h-48 space-y-0.5 overflow-y-auto p-1">
				{visible.map((grp) => (
					<label
						key={grp.id}
						className="flex cursor-pointer items-center gap-2 rounded-sm p-1.5 text-sm text-stone-800 hover:bg-stone-100 dark:text-stone-200 dark:hover:bg-stone-800"
					>
						<input
							type="checkbox"
							checked={value.includes(grp.id)}
							onChange={(e) =>
								onChange(
									e.target.checked
										? [...value, grp.id]
										: value.filter((id) => id !== grp.id),
								)
							}
							className={cn(
								"h-4 w-4 rounded-sm border-stone-400",
								checkboxClassName,
							)}
						/>
						<span>{grp.name}</span>
					</label>
				))}
				{visible.length === 0 && total > 0 && (
					<p className="p-2 text-xs text-stone-600 dark:text-stone-400">
						{t("eiHakutuloksia", "Ei hakutuloksia")}
					</p>
				)}
			</div>
		</div>
	);
}
