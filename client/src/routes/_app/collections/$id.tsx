import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useCollection, useDeleteCollection } from "#/hooks/useCollections";
import { formatDate } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/collections/$id")({
	component: ViewCollectionPage,
});

function ViewCollectionPage() {
	const { t } = useTranslation();
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
		if (confirm("Haluatko varmasti poistaa tämän kokoelman?")) {
			await deleteCollection.mutateAsync(id);
			navigate({ to: "/collections" });
		}
	};

	return (
		<div className="p-4 max-w-xl flex flex-col gap-6">
			{/* Back navigation */}
			<Link
				to="/collections"
				className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline"
			>
				<ArrowLeft size={14} /> {t("takaisinKokoelmiin", "Takaisin kokoelmiin")}
			</Link>

			{/* 1. Header: Name & ID Chip */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
					{collection.name}
				</h1>
				<Chip>{readable_uuid(collection.id)}</Chip>
			</div>

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
