import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DetailLayout } from "#/components/DetailLayout";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { RichTextContent } from "#/components/RichTextContent";
import { useIsAdmin } from "#/hooks/useAuth";
import { useCollection, useDeleteCollection } from "#/hooks/useCollections";
import { useResources } from "#/hooks/useResorces";
import { getCollectionIcon } from "#/utils/collectionIcons";
import { getLocalizedPlainText } from "#/utils/richText";

export const Route = createFileRoute("/_app/collections/$id")({
	component: ViewCollectionPage,
});

function ViewCollectionPage() {
	const { t, i18n } = useTranslation();
	const { isAdmin } = useIsAdmin();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: collection, isLoading, isError } = useCollection(id);
	const { data: resources } = useResources();
	const deleteCollection = useDeleteCollection();

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanKokoelmaa", "Ladataan kokoelmaa...")}
			</p>
		);
	if (isError || !collection)
		return (
			<Callout variant="danger">
				{t("kokoelmaaEiLytynyt", "Kokoelmaa ei löytynyt.")}
			</Callout>
		);

	const handleDelete = async () => {
		if (
			confirm(
				t(
					"vahvistaKokoelmanPoisto",
					"Haluatko varmasti poistaa tämän kokoelman?",
				),
			)
		) {
			await deleteCollection.mutateAsync(id);
			navigate({ to: "/collections" });
		}
	};

	const items = (resources ?? []).filter((r) => r.collection_id === id);

	return (
		<DetailLayout
			width="wide"
			title={collection.name}
			back={
				<BackLink to="/collections">
					{t("takaisinKokoelmiin", "Takaisin kokoelmiin")}
				</BackLink>
			}
			subtitle={t("resourcecountResurssia", "{{resourceCount}} resurssia", {
				resourceCount: items.length,
			})}
			actions={
				isAdmin && (
					<Button variant="outline" asChild>
						<Link to="/collections/edit/$id" params={{ id: collection.id }}>
							{t("muokkaa", "Muokkaa")}
						</Link>
					</Button>
				)
			}
			dangerZone={
				isAdmin && (
					<Button
						variant="danger-outline"
						onClick={handleDelete}
						disabled={deleteCollection.isPending}
					>
						<Trash2 size={16} />
						<span>{t("poistaKokoelma", "Poista kokoelma")}</span>
					</Button>
				)
			}
			technical={{
				id: collection.id,
				createdAt: collection.created_at,
				updatedAt: collection.updated_at,
			}}
		>
			<RichTextContent
				value={collection.description}
				className="max-w-3xl rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900"
			/>

			<section className="space-y-3">
				<h2 className="text-lg font-semibold">{t("resurssit", "Resurssit")}</h2>
				{items.length > 0 ? (
					<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
						{items.map((res) => (
							<li key={res.id} className="flex min-w-0 flex-col [&>a]:h-full">
								<EntityCard
									to="/resources/$id"
									params={{ id: res.id }}
									title={res.name}
									icon={getCollectionIcon(res.collection_icon)}
									description={
										getLocalizedPlainText(res.description, i18n.language) ||
										undefined
									}
								/>
							</li>
						))}
					</ul>
				) : (
					<EmptyState
						title={t(
							"eiResurssejaKokoelmassa",
							"Tässä kokoelmassa ei ole resursseja.",
						)}
					/>
				)}
			</section>
		</DetailLayout>
	);
}
