// src/routes/resources/$id.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { RichTextContent } from "#/components/RichTextContent";
import { useCollection } from "#/hooks/useCollections";
import { useDeleteResource, useResource } from "#/hooks/useResorces";
import { useDateFormatter } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/resources/$id")({
	component: ViewResourcePage,
});

function ViewResourcePage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: resource, isLoading, isError } = useResource(id);
	const { data: collection } = useCollection(resource?.collection_id ?? "");
	const deleteResource = useDeleteResource();

	if (isLoading)
		return (
			<div className="p-4 text-sm text-stone-500">
				{t("ladataanResurssia", "Ladataan resurssia...")}
			</div>
		);
	if (isError || !resource)
		return (
			<div className="p-4 text-sm text-red-500">
				{t("resurssiaEiLytynyt", "Resurssia ei löytynyt.")}
			</div>
		);

	const handleDelete = async () => {
		if (
			confirm(
				t(
					"vahvistaResurssinPoisto",
					"Haluatko varmasti poistaa tämän resurssin?",
				),
			)
		) {
			await deleteResource.mutateAsync(id);
			navigate({ to: "/resources" });
		}
	};

	return (
		<div className="p-4 max-w-xl flex flex-col gap-6">
			{/* Back navigation */}
			<BackLink to="/resources">
				{t("takaisinResursseihin", "Takaisin resursseihin")}
			</BackLink>

			{/* 1. Header: Name & ID Chip */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
					{resource.name}
				</h1>
				<Chip>{readable_uuid(resource.id)}</Chip>
			</div>

			{/* 2. Localized rich-text description */}
			<RichTextContent
				value={resource.description}
				className="p-3 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900"
			/>

			<div className="space-y-2">
				<div className="text-md">
					<p>
						<strong>{t("kokoelma2", "Kokoelma:")}</strong>{" "}
						{collection?.name ?? "—"}
					</p>
					<hr className="my-2 border-stone-300" />
					<p>
						<strong>{t("muokattu", "Muokattu:")}</strong>{" "}
						{formatDate(resource.updated_at)}
					</p>
					<p>
						<strong>{t("luotu", "Luotu:")}</strong>{" "}
						{formatDate(resource.created_at)}
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
					<Link to="/resources/edit/$id" params={{ id: resource.id }}>
						<span>{t("muokkaa", "Muokkaa")}</span>
						<Edit size={16} />
					</Link>
				</Button>

				<Button
					variant="danger"
					className="w-full flex items-center justify-center gap-2"
					onClick={handleDelete}
					disabled={deleteResource.isPending}
				>
					<span>{t("poistaResurssi", "Poista resurssi")}</span>
					<Trash2 size={16} />
				</Button>
			</div>
		</div>
	);
}
