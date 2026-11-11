import { useMemo } from "react";
import { ResourceFilter } from "#/components/calendar/ResourceFilter";
import { useCollections } from "#/hooks/useCollections";
import { useResources } from "#/hooks/useResorces";

interface ResourceFilterFieldProps {
	/** Selected resource ids; undefined means all resources */
	value: string[] | undefined;
	/** Called with the new selection, or undefined when it covers every resource */
	onChange: (next: string[] | undefined) => void;
	className?: string;
}

/**
 * The calendar's resource filter for list pages. Loads the resources itself and keeps
 * the URL tidy: "everything selected" is stored as no selection.
 */
export function ResourceFilterField({
	value,
	onChange,
	className,
}: ResourceFilterFieldProps) {
	const { data: resources } = useResources();
	const { data: collections } = useCollections();
	const allIds = useMemo(() => (resources ?? []).map((r) => r.id), [resources]);
	const selected = value ?? allIds;

	if (!resources || resources.length === 0) return null;

	return (
		<ResourceFilter
			className={className}
			resources={resources}
			collections={collections ?? []}
			selectedIds={selected}
			onChange={(ids) =>
				onChange(
					ids.length === allIds.length && allIds.every((id) => ids.includes(id))
						? undefined
						: ids,
				)
			}
		/>
	);
}
