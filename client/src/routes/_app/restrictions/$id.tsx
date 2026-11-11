import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { DetailLayout } from "#/components/DetailLayout";
import { EmptyState } from "#/components/EmptyState";
import { OccurrenceListCollapsible } from "#/components/OccurrenceListCollapsible";
import { PageContainer } from "#/components/PageContainer";
import { useIsAdmin } from "#/hooks/useAuth";
import { useGroups } from "#/hooks/useGroups";
import { useResources } from "#/hooks/useResorces";
import {
	useDeleteRestriction,
	useRestriction,
	useSplitRestriction,
} from "#/hooks/useRestrictions";
import { canSplitOccurrence, planSplit } from "#/utils/series";

export const Route = createFileRoute("/_app/restrictions/$id")({
	component: ViewRestrictionPage,
});

function ViewRestrictionPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { isAdmin } = useIsAdmin();

	const isValidUuid = Boolean(id && id.length > 8);

	const {
		data: restrictionWithOcc,
		isLoading,
		isError,
	} = useRestriction(isValidUuid ? id : "");
	const { data: resources } = useResources();
	const { data: groups } = useGroups();
	const deleteRestriction = useDeleteRestriction();
	const splitRestriction = useSplitRestriction();

	if (!isValidUuid || isError || (!isLoading && !restrictionWithOcc)) {
		return (
			<PageContainer width="default">
				<BackLink to="/restrictions">
					{t("takaisinRajoituksiin", "Takaisin rajoituksiin")}
				</BackLink>
				<EmptyState
					title={t("rajoitustaEiLytynyt", "Rajoitusta ei löytynyt.")}
				/>
			</PageContainer>
		);
	}

	// Also narrows restrictionWithOcc for the rest of the component
	if (isLoading || !restrictionWithOcc) {
		return (
			<PageContainer width="default">
				<p className="text-sm text-stone-600 dark:text-stone-400">
					{t("ladataanRajoitusta", "Ladataan rajoitusta...")}
				</p>
			</PageContainer>
		);
	}

	const resourceMap = new Map(resources?.map((r) => [r.id, r.name]));
	const groupMap = new Map(groups?.map((g) => [g.id, g.name]));

	const occurrences = restrictionWithOcc.occurrences || [];
	const exemptGroupNames = restrictionWithOcc.exempt_group_ids.map(
		(gId) => groupMap.get(gId) || gId,
	);

	const rrule = restrictionWithOcc.rrule;
	const handleDetach = async (occurrenceId: string) => {
		const occurrence = occurrences.find((o) => o.id === occurrenceId);
		if (!rrule || !occurrence) return;
		const created = await splitRestriction.mutateAsync({
			id,
			...planSplit(rrule, occurrences, occurrence),
		});
		navigate({ to: "/restrictions/edit/$id", params: { id: created.id } });
	};

	const handleDelete = async () => {
		if (
			confirm(
				t(
					"vahvistaRajoituksenPoisto",
					"Haluatko varmasti poistaa tämän rajoituksen?",
				),
			)
		) {
			await deleteRestriction.mutateAsync(id);
			navigate({ to: "/restrictions" });
		}
	};

	return (
		<DetailLayout
			back={
				<BackLink to="/restrictions">
					{t("takaisinRajoituksiin", "Takaisin rajoituksiin")}
				</BackLink>
			}
			title={restrictionWithOcc.title}
			subtitle={restrictionWithOcc.description ?? undefined}
			actions={
				isAdmin && (
					<Button variant="outline" asChild>
						<Link to="/restrictions/edit/$id" params={{ id }}>
							<Edit size={16} />
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
						disabled={deleteRestriction.isPending}
					>
						<Trash2 size={16} />
						{t("poista", "Poista")}
					</Button>
				)
			}
			technical={{
				id: restrictionWithOcc.id,
				createdAt: restrictionWithOcc.created_at,
				updatedAt: restrictionWithOcc.updated_at,
			}}
		>
			<section className="space-y-3">
				<h2 className="text-lg font-semibold">
					{t("rajoitetutAjanjaksot", "Rajoitetut ajanjaksot ({{count}})", {
						count: occurrences.length,
					})}
				</h2>
				<OccurrenceListCollapsible
					items={occurrences.map((occ) => ({
						id: occ.id,
						start_time: occ.start_time,
						end_time: occ.end_time,
						groupLabel: occ.resource_id
							? resourceMap.get(occ.resource_id) || occ.resource_id
							: t("kaikkiResurssitGlobaali", "Kaikki resurssit (globaali)"),
						canDetach: isAdmin && canSplitOccurrence(rrule, occurrences, occ),
					}))}
					onDetach={handleDetach}
					detachDisabled={splitRestriction.isPending}
				/>
			</section>

			<section className="space-y-3">
				<h2 className="text-lg font-semibold">
					{t("sallitutRyhmat", "Sallitut käyttäjäryhmät")}
				</h2>
				{exemptGroupNames.length > 0 ? (
					<div className="flex flex-wrap gap-1.5">
						{exemptGroupNames.map((name) => (
							<Chip key={name}>{name}</Chip>
						))}
					</div>
				) : (
					<p className="text-sm text-stone-600 dark:text-stone-400">
						{t(
							"eiPoikkeuksiaKaikkiEstetty",
							"Ei sallittuja ryhmiä (rajoitus koskee kaikkia)",
						)}
					</p>
				)}
			</section>
		</DetailLayout>
	);
}
