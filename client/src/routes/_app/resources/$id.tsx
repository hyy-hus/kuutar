// src/routes/_app/resources/$id.tsx
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { CalendarPlus, Lock, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AccessSummary } from "#/components/AccessSummary";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DetailLayout } from "#/components/DetailLayout";
import { RichTextContent } from "#/components/RichTextContent";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { useCollection } from "#/hooks/useCollections";
import { useGroups } from "#/hooks/useGroups";
import { useDeleteResource, useResource } from "#/hooks/useResorces";
import { getCollectionIcon } from "#/utils/collectionIcons";
import { summarizeResourceAccess } from "#/utils/resourceAccess";

export const Route = createFileRoute("/_app/resources/$id")({
	component: ViewResourcePage,
});

function ViewResourcePage() {
	const { t } = useTranslation();
	const { isAdmin } = useIsAdmin();
	const { user } = useAuth();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: resource, isLoading, isError } = useResource(id);
	const { data: collection } = useCollection(resource?.collection_id ?? "");
	const CollectionIcon = getCollectionIcon(resource?.collection_icon);
	const deleteResource = useDeleteResource();
	const { data: groups } = useGroups({ enabled: isAdmin });

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanResurssia", "Ladataan resurssia...")}
			</p>
		);
	if (isError || !resource)
		return (
			<Callout variant="danger">
				{t("resurssiaEiLytynyt", "Resurssia ei löytynyt.")}
			</Callout>
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
		<DetailLayout
			title={resource.name}
			back={
				<BackLink to="/resources">
					{t("takaisinResursseihin", "Takaisin resursseihin")}
				</BackLink>
			}
			subtitle={
				<span className="inline-flex items-center gap-1.5">
					<CollectionIcon size={14} aria-hidden="true" className="shrink-0" />
					{collection ? (
						<Link
							to="/collections/$id"
							params={{ id: collection.id }}
							className="focus-ring text-purple-700 hover:underline dark:text-purple-400"
						>
							{collection.name}
						</Link>
					) : (
						"—"
					)}
				</span>
			}
			actions={
				<>
					{resource.can_reserve && (
						<Button asChild>
							<Link
								to="/reservations/create"
								search={{ resource_ids: [resource.id] }}
							>
								<CalendarPlus size={16} />
								<span>{t("varaa", "Varaa")}</span>
							</Link>
						</Button>
					)}
					{isAdmin && (
						<Button variant="outline" asChild>
							<Link to="/resources/edit/$id" params={{ id: resource.id }}>
								{t("muokkaa", "Muokkaa")}
							</Link>
						</Button>
					)}
				</>
			}
			dangerZone={
				isAdmin && (
					<Button
						variant="danger-outline"
						onClick={handleDelete}
						disabled={deleteResource.isPending}
					>
						<Trash2 size={16} />
						<span>{t("poistaResurssi", "Poista resurssi")}</span>
					</Button>
				)
			}
			technical={{
				id: resource.id,
				createdAt: resource.created_at,
				updatedAt: resource.updated_at,
			}}
		>
			<RichTextContent
				value={resource.description}
				className="rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900"
			/>

			{/* Who can see, reserve and get confirmed */}
			{isAdmin ? (
				<AccessSummary
					groups={groups}
					summary={summarizeResourceAccess({
						is_public: resource.is_public,
						visibility_group_ids: resource.visible_group_ids,
						reservation_restricted: resource.reservation_restricted,
						reserve_group_ids: resource.reservable_group_ids,
						auto_confirm: resource.auto_confirm,
						auto_confirm_group_ids: resource.auto_confirm_group_ids,
					})}
				/>
			) : (
				!resource.can_reserve && (
					<Callout variant="warning" icon={Lock}>
						{user
							? t(
									"eiVarausoikeutta",
									"Sinulla ei ole oikeutta varata tätä resurssia.",
								)
							: t(
									"kirjauduVarataksesi",
									"Kirjaudu sisään, jos haluat varata tämän.",
								)}
					</Callout>
				)
			)}
		</DetailLayout>
	);
}
