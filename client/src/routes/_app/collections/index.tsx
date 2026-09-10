// src/routes/_app/collections/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Layers, Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useIsAdmin } from "#/hooks/useAuth";
import { type Collection, useCollections } from "#/hooks/useCollections";
import { useResources } from "#/hooks/useResorces";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/collections/")({
	component: RouteComponent,
});

function CollectionCard({
	collection,
	resourceCount,
}: {
	collection: Collection;
	resourceCount: number;
}) {
	const { t } = useTranslation();
	return (
		<li className="p-3 border-2 border-stone-800 dark:border-stone-700 flex flex-col justify-between gap-3 rounded-md bg-stone-50 dark:bg-stone-900 shadow-xs hover:border-purple-600 dark:hover:border-purple-500 transition-colors min-w-0">
			<div className="space-y-2 min-w-0">
				{/* Header: Name and ID Chip */}
				<div className="flex items-start justify-between gap-2 min-w-0">
					<h3 className="font-bold text-sm md:text-base text-stone-900 dark:text-stone-100 truncate flex-1">
						{collection.name}
					</h3>
					<Chip>{readable_uuid(collection.id)}</Chip>
				</div>

				{/* Resource Count Badge */}
				<div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
					<Layers size={14} className="shrink-0" />
					<span>
						{t("resourcecountResurssia", "{{resourceCount}} resurssia", {
							resourceCount,
						})}
					</span>
				</div>

				{/* Description */}
				<p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 min-h-8">
					{collection.description ||
						t("eiKuvaustaSaatavilla2", "Ei kuvausta saatavilla.")}
				</p>
			</div>

			{/* Bottom Action Row */}
			<div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 shrink-0">
				<Button
					variant="secondary"
					size="sm"
					asChild
					className="gap-1.5 text-xs"
				>
					<Link to="/collections/$id" params={{ id: collection.id }}>
						<span>{t("nyt", "Näytä")}</span>
						<Eye size={14} />
					</Link>
				</Button>
			</div>
		</li>
	);
}

function CollectionList() {
	const { t } = useTranslation();
	const { isAdmin } = useIsAdmin();
	const {
		data: collections,
		isLoading: loadingCollections,
		isError: errorCollections,
	} = useCollections();
	const {
		data: resources,
		isLoading: loadingResources,
		isError: errorResources,
	} = useResources();

	if (loadingCollections || loadingResources) {
		return (
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanKokoelmia", "Ladataan kokoelmia...")}</span>
			</div>
		);
	}

	if (errorCollections || errorResources) {
		return (
			<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</div>
		);
	}

	// Count assigned resources per collection
	const resourceCounts = new Map<string, number>();
	resources?.forEach((res) => {
		const current = resourceCounts.get(res.collection_id) ?? 0;
		resourceCounts.set(res.collection_id, current + 1);
	});

	return (
		<div className="flex flex-col gap-4 p-2 sm:p-4 flex-1 min-h-0 min-w-0">
			{/* Header & Admin Action */}
			<div className="flex items-center justify-between gap-2 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<div>
					<h1 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
						{t("kokoelmat", "Kokoelmat")}
					</h1>
					<p className="text-xs text-stone-500">
						{t("yhteens", "Yhteensä")} {collections?.length || 0} kokoelmaa
					</p>
				</div>

				{isAdmin && (
					<Button asChild size="sm" className="gap-1.5 shrink-0">
						<Link to="/collections/create">
							<Plus size={16} />
							<span>{t("lisKokoelma", "Lisää kokoelma")}</span>
						</Link>
					</Button>
				)}
			</div>

			{/* Grid Listing */}
			<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{collections?.map((col) => (
					<CollectionCard
						key={col.id}
						collection={col}
						resourceCount={resourceCounts.get(col.id) ?? 0}
					/>
				))}
			</ul>
		</div>
	);
}

function RouteComponent() {
	return <CollectionList />;
}
