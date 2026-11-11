// src/routes/_app/collections/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { useIsAdmin } from "#/hooks/useAuth";
import { useCollections } from "#/hooks/useCollections";
import { useResources } from "#/hooks/useResorces";
import { getCollectionIcon } from "#/utils/collectionIcons";
import { getLocalizedPlainText } from "#/utils/richText";

export const Route = createFileRoute("/_app/collections/")({
	component: CollectionList,
});

function CollectionList() {
	const { t, i18n } = useTranslation();
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
			<div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanKokoelmia", "Ladataan kokoelmia...")}</span>
			</div>
		);
	}

	if (errorCollections || errorResources) {
		return (
			<Callout variant="danger">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</Callout>
		);
	}

	// Count assigned resources per collection
	const resourceCounts = new Map<string, number>();
	for (const res of resources ?? []) {
		resourceCounts.set(
			res.collection_id,
			(resourceCounts.get(res.collection_id) ?? 0) + 1,
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title={t("kokoelmat", "Kokoelmat")}
				subtitle={t("yhteensaKokoelmia", "Yhteensä {{count}} kokoelmaa", {
					count: collections?.length ?? 0,
				})}
				actions={
					isAdmin && (
						<Button asChild>
							<Link to="/collections/create">
								<Plus size={16} />
								<span>{t("lisKokoelma", "Lisää kokoelma")}</span>
							</Link>
						</Button>
					)
				}
			/>

			{collections && collections.length > 0 ? (
				<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{collections.map((col) => (
						<li key={col.id} className="flex min-w-0 flex-col [&>a]:h-full">
							<EntityCard
								to="/collections/$id"
								params={{ id: col.id }}
								title={col.name}
								icon={getCollectionIcon(col.icon)}
								meta={t(
									"resourcecountResurssia",
									"{{resourceCount}} resurssia",
									{ resourceCount: resourceCounts.get(col.id) ?? 0 },
								)}
								description={
									getLocalizedPlainText(col.description, i18n.language) ||
									undefined
								}
							/>
						</li>
					))}
				</ul>
			) : (
				<EmptyState title={t("eiKokoelmia", "Ei kokoelmia.")} />
			)}
		</PageContainer>
	);
}
