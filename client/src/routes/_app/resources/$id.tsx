// src/routes/resources/$id.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useCollection } from "#/hooks/useCollections";
import { useDeleteResource, useResource } from "#/hooks/useResorces";
import { formatDate } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/resources/$id")({
	component: ViewResourcePage,
});

function ViewResourcePage() {
	const { t } = useTranslation();
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
		if (confirm("Haluatko varmasti poistaa tämän resurssin?")) {
			await deleteResource.mutateAsync(id);
			navigate({ to: "/resources" });
		}
	};

	return (
		<div className="p-4 max-w-xl flex flex-col gap-6">
			{/* Back navigation */}
			<Link
				to="/resources"
				className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline"
			>
				<ArrowLeft size={14} />{" "}
				{t("takaisinResursseihin", "Takaisin resursseihin")}
			</Link>

			{/* 1. Header: Name & ID Chip */}
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
					{resource.name}
				</h1>
				<Chip>{readable_uuid(resource.id)}</Chip>
			</div>

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
