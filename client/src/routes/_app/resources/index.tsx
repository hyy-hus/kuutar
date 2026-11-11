// src/routes/_app/resources/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, EyeOff, Loader2, Plus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { FilterBar } from "#/components/FilterBar";
import { Input } from "#/components/Input";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { Select } from "#/components/Select";
import { StatusChip } from "#/components/StatusChip";
import { useIsAdmin } from "#/hooks/useAuth";
import { type Collection, useCollections } from "#/hooks/useCollections";
import { type Resource, useResources } from "#/hooks/useResorces";
import { getCollectionIcon } from "#/utils/collectionIcons";
import { getLocalizedPlainText } from "#/utils/richText";

export const Route = createFileRoute("/_app/resources/")({
	component: ResourceList,
});

function ResourceCard({ resource }: { resource: Resource }) {
	const { t, i18n } = useTranslation();
	const badges = [
		!resource.is_public && (
			<span
				key="hidden"
				title={t(
					"rajattuNakyvyysOhje",
					"Resurssi näkyy vain ylläpitäjille ja valituille ryhmille.",
				)}
			>
				<StatusChip variant="neutral" icon={EyeOff}>
					{t("rajattuNakyvyys", "Rajattu näkyvyys")}
				</StatusChip>
			</span>
		),
		resource.reservation_restricted && (
			<span
				key="restricted"
				title={t(
					"rajattuVarausoikeusOhje",
					"Vain valitut ryhmät voivat varata tämän resurssin.",
				)}
			>
				<StatusChip variant="warning" icon={Users}>
					{t("rajattuVarausoikeus", "Rajattu varausoikeus")}
				</StatusChip>
			</span>
		),
		resource.auto_confirm && (
			<span
				key="auto"
				title={t(
					"vahvistuuAutomaattisestiOhje",
					"Varaukset vahvistuvat ilman ylläpitäjän hyväksyntää.",
				)}
			>
				<StatusChip variant="success" icon={CheckCircle2}>
					{t("vahvistuuAutomaattisesti", "Vahvistuu automaattisesti")}
				</StatusChip>
			</span>
		),
	].filter(Boolean);

	return (
		<EntityCard
			to="/resources/$id"
			params={{ id: resource.id }}
			title={resource.name}
			icon={getCollectionIcon(resource.collection_icon)}
			description={
				getLocalizedPlainText(resource.description, i18n.language) || undefined
			}
			badges={badges.length > 0 ? badges : undefined}
		/>
	);
}

function CollectionGroup({
	collection,
	resources,
}: {
	collection?: Collection;
	resources: Resource[];
}) {
	const { t } = useTranslation();
	const Icon = getCollectionIcon(collection?.icon);
	return (
		<section className="space-y-3">
			<h2 className="flex items-center gap-2 text-lg font-semibold">
				<Icon size={18} aria-hidden="true" className="shrink-0" />
				{collection ? (
					<Link
						to="/collections/$id"
						params={{ id: collection.id }}
						className="focus-ring hover:underline"
					>
						{collection.name}
					</Link>
				) : (
					t("ilmanKokoelmaa", "Ilman kokoelmaa")
				)}
				<span className="text-xs font-normal text-stone-600 tabular-nums dark:text-stone-400">
					{resources.length}
				</span>
			</h2>
			<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{resources.map((res) => (
					<li key={res.id} className="flex min-w-0 flex-col [&>a]:h-full">
						<ResourceCard resource={res} />
					</li>
				))}
			</ul>
		</section>
	);
}

function ResourceList() {
	const { t, i18n } = useTranslation();
	const { isAdmin } = useIsAdmin();
	const [query, setQuery] = useState("");
	const [collectionId, setCollectionId] = useState("");
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

	const groups = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const matches = (res: Resource) =>
			(!collectionId || res.collection_id === collectionId) &&
			(!needle ||
				res.name.toLowerCase().includes(needle) ||
				getLocalizedPlainText(res.description, i18n.language)
					.toLowerCase()
					.includes(needle));
		const visible = (resources ?? []).filter(matches);
		const known = new Set((collections ?? []).map((c) => c.id));
		const result: { collection?: Collection; resources: Resource[] }[] = [];
		for (const collection of collections ?? []) {
			const items = visible.filter((r) => r.collection_id === collection.id);
			if (items.length > 0) result.push({ collection, resources: items });
		}
		const orphans = visible.filter((r) => !known.has(r.collection_id));
		if (orphans.length > 0) result.push({ resources: orphans });
		return result;
	}, [resources, collections, query, collectionId, i18n.language]);

	if (loadingResources || loadingCollections) {
		return (
			<div className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-400">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanResursseja", "Ladataan resursseja...")}</span>
			</div>
		);
	}

	if (errorResources || errorCollections) {
		return (
			<Callout variant="danger">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</Callout>
		);
	}

	const total = resources?.length ?? 0;

	return (
		<PageContainer>
			<PageHeader
				title={t("resurssit", "Resurssit")}
				subtitle={t("yhteensaResursseja", "Yhteensä {{count}} resurssia", {
					count: total,
				})}
				actions={
					isAdmin && (
						<Button asChild>
							<Link to="/resources/create">
								<Plus size={16} />
								<span>{t("lisResurssi", "Lisää resurssi")}</span>
							</Link>
						</Button>
					)
				}
			/>

			{total > 0 && (
				<FilterBar>
					<Input
						type="search"
						size="sm"
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={t("haeResursseja", "Hae resursseja")}
						aria-label={t("haeResursseja", "Hae resursseja")}
						className="w-56"
					/>
					<Select
						size="sm"
						wrapperClassName="w-auto"
						value={collectionId}
						onChange={(e) => setCollectionId(e.target.value)}
						aria-label={t("kokoelma", "Kokoelma")}
					>
						<option value="">{t("kaikkiKokoelmat", "Kaikki kokoelmat")}</option>
						{collections?.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</Select>
				</FilterBar>
			)}

			{total === 0 ? (
				<EmptyState title={t("eiResursseja", "Ei resursseja.")} />
			) : groups.length === 0 ? (
				<EmptyState
					title={t(
						"eiHakuaVastaaviaResursseja",
						"Ei hakua vastaavia resursseja.",
					)}
				/>
			) : (
				groups.map((g) => (
					<CollectionGroup
						key={g.collection?.id ?? "none"}
						collection={g.collection}
						resources={g.resources}
					/>
				))
			)}
		</PageContainer>
	);
}
