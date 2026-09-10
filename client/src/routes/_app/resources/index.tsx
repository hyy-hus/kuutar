// src/routes/_app/resources/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Folder, Loader2, Plus, RefreshCw } from "lucide-react";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useCollections, type Collection } from "#/hooks/useCollections";
import { useResources, type Resource } from "#/hooks/useResorces";
import { useIsAdmin } from "#/hooks/useAuth";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/resources/")({
	component: RouteComponent,
});

function ResourceCard({
	resource,
	collection,
}: {
	resource: Resource;
	collection?: Collection;
}) {
	return (
		<li className="p-3 border-2 border-stone-800 dark:border-stone-700 flex flex-col justify-between gap-3 rounded-md bg-stone-50 dark:bg-stone-900 shadow-xs hover:border-purple-600 dark:hover:border-purple-500 transition-colors min-w-0">
			<div className="space-y-2 min-w-0">
				{/* Header: Name and ID Chip */}
				<div className="flex items-start justify-between gap-2 min-w-0">
					<h3 className="font-bold text-sm md:text-base text-stone-900 dark:text-stone-100 truncate flex-1">
						{resource.name}
					</h3>
					<Chip>{readable_uuid(resource.id)}</Chip>
				</div>

				{/* Collection Link */}
				{collection && (
					<div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
						<Folder size={14} className="shrink-0" />
						<Link
							to="/collections/$id"
							params={{ id: collection.id }}
							className="hover:underline font-medium truncate"
						>
							{collection.name}
						</Link>
					</div>
				)}

				{/* Description */}
				<p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 min-h-8">
					{resource.description || "Ei kuvausta saantiilla."}
				</p>
			</div>

			{/* Bottom Controls */}
			<div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 shrink-0">
				{/* Capability Badge */}
				{(resource as { allow_recurring?: boolean }).allow_recurring ? (
					<span className="inline-flex items-center gap-1 text-[10px] font-mono text-stone-600 dark:text-stone-400 bg-stone-200/60 dark:bg-stone-800 px-1.5 py-0.5 rounded">
						<RefreshCw size={10} />
						<span>Toistuva</span>
					</span>
				) : (
					<div />
				)}

				<Button
					variant="secondary"
					size="sm"
					asChild
					className="gap-1.5 text-xs"
				>
					<Link to="/resources/$id" params={{ id: resource.id }}>
						<span>Näytä</span>
						<Eye size={14} />
					</Link>
				</Button>
			</div>
		</li>
	);
}

function ResourceList() {
	const { isAdmin } = useIsAdmin();
	const {
		data: resources,
		isLoading: loadingResources,
		isError: errorResources,
	} = useResources();
	const {
		data: collections,
		isLoading: loadingCollections,
		isError: errorCollections,
	} = useCollections();

	if (loadingResources || loadingCollections) {
		return (
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>Ladataan resursseja...</span>
			</div>
		);
	}

	if (errorResources || errorCollections) {
		return (
			<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
				Virhe ladattaessa tietoja.
			</div>
		);
	}

	const collectionsMap = new Map(collections?.map((c) => [c.id, c]));

	return (
		<div className="flex flex-col gap-4 p-2 sm:p-4 flex-1 min-h-0 min-w-0">
			{/* Header & Admin Action */}
			<div className="flex items-center justify-between gap-2 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<div>
					<h1 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
						Resurssit
					</h1>
					<p className="text-xs text-stone-500">
						Yhteensä {resources?.length || 0} resurssia
					</p>
				</div>

				{isAdmin && (
					<Button asChild size="sm" className="gap-1.5 shrink-0">
						<Link to="/resources/create">
							<Plus size={16} />
							<span>Lisää resurssi</span>
						</Link>
					</Button>
				)}
			</div>

			{/* Grid Listing */}
			<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{resources?.map((res) => (
					<ResourceCard
						key={res.id}
						resource={res}
						collection={collectionsMap.get(res.collection_id)}
					/>
				))}
			</ul>
		</div>
	);
}

function RouteComponent() {
	return <ResourceList />;
}
