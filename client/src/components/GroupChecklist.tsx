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
}

/** Scrollable checkbox list for picking a set of groups */
export function GroupChecklist({
	groups,
	loading = false,
	value,
	onChange,
	className,
	checkboxClassName = "text-purple-600 focus:ring-purple-500",
}: GroupChecklistProps) {
	const { t } = useTranslation();

	if (loading) {
		return (
			<div className="text-xs text-stone-500 py-2">
				{t("ladataanRyhmia", "Ladataan ryhmiä...")}
			</div>
		);
	}

	return (
		<div
			className={cn(
				"space-y-1.5 max-h-36 overflow-y-auto p-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md",
				className,
			)}
		>
			{groups?.map((grp) => (
				<label
					key={grp.id}
					className="flex items-center gap-2 text-xs text-stone-800 dark:text-stone-200 font-medium cursor-pointer p-1 hover:bg-stone-100 dark:hover:bg-stone-800 rounded"
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
							"w-4 h-4 rounded border-stone-300",
							checkboxClassName,
						)}
					/>
					<span>{grp.name}</span>
				</label>
			))}
		</div>
	);
}
