import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { RichTextContent } from "#/components/RichTextContent";
import { useCollection, useDeleteCollection } from "#/hooks/useCollections";
import { getCollectionIcon } from "#/utils/collectionIcons";
import { useDateFormatter } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/collections/$id")({
	component: ViewCollectionPage,
});

function ViewCollectionPage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: collection, isLoading, isError } = useCollection(id);
	const deleteCollection = useDeleteCollection();

	if (isLoading)
		return (
			<div className="p-4 text-sm text-stone-500">
				{t("ladataanKokoelmaa", "Ladataan kokoelmaa...")}
			</div>
		);
	if (isError || !collection)
		return (
			<div className="p-4 text-sm text-red-500">
				{t("kokoelmaaEiLytynyt", "Kokoelmaa ei löytynyt.")}
			</div>
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

	const CollectionIcon = getCollectionIcon(collection.icon);

	return (
		<div className="p-4 max-w-xl flex flex-col gap-6">
			{/* Back navigation */}
			<BackLink to="/collections">
				{t("takaisinKokoelmiin", "Takaisin kokoelmiin")}
			</BackLink>

			{/* 1. Header: Name & ID Chip */}
			<div className="flex items-center justify-between">
				<h1 className="flex items-center gap-2 text-2xl font-bold text-stone-900 dark:text-stone-100">
					<CollectionIcon size={24} className="shrink-0" />
					{collection.name}
				</h1>
				<Chip>{readable_uuid(collection.id)}</Chip>
			</div>

			{/* 2. Localized rich-text description */}
			<RichTextContent
				value={collection.description}
				className="p-3 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900"
			/>

			<div className="space-y-2">
				<div className="text-md">
					<p>
						<strong>{t("muokattu", "Muokattu:")}</strong>{" "}
						{formatDate(collection.updated_at)}
					</p>
					<p>
						<strong>{t("luotu", "Luotu:")}</strong>{" "}
						{formatDate(collection.created_at)}
					</p>
				</div>
			</div>

			{/* 3. Vertically Stacked Action Buttons */}
			<div className="flex flex-col gap-2 pt-2">
				<Button
					variant="secondary"
					className="w-full flex items-center justify-center gap-2"
					asChild
				>
					<Link to="/collections/edit/$id" params={{ id: collection.id }}>
						<span>{t("muokkaa", "Muokkaa")}</span>
						<Edit size={16} />
					</Link>
				</Button>

				<Button
					variant="danger"
					className="w-full flex items-center justify-center gap-2"
					onClick={handleDelete}
					disabled={deleteCollection.isPending}
				>
					<span>{t("poistaKokoelma", "Poista kokoelma")}</span>
					<Trash2 size={16} />
				</Button>
			</div>
		</div>
	);
}
