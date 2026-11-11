import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { DetailLayout } from "#/components/DetailLayout";
import { EmptyState } from "#/components/EmptyState";
import { OccurrenceListCollapsible } from "#/components/OccurrenceListCollapsible";
import { PageContainer } from "#/components/PageContainer";
import { useIsAdmin } from "#/hooks/useAuth";
import {
	useDeleteReservableBlock,
	useReservableBlock,
	useSplitReservableBlock,
} from "#/hooks/useReservableBlocks";
import { useResources } from "#/hooks/useResorces";
import { canSplitOccurrence, planSplit } from "#/utils/series";

export const Route = createFileRoute("/_app/reservable-blocks/$id")({
	component: ViewReservableBlockPage,
});

function ViewReservableBlockPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { isAdmin } = useIsAdmin();

	const isValidUuid = Boolean(id && id.length > 8);

	const {
		data: block,
		isLoading,
		isError,
	} = useReservableBlock(isValidUuid ? id : "");
	const { data: resources } = useResources();
	const deleteBlock = useDeleteReservableBlock();
	const splitBlock = useSplitReservableBlock();

	if (!isValidUuid || isError || (!isLoading && !block)) {
		return (
			<PageContainer width="default">
				<BackLink to="/reservable-blocks">
					{t("takaisinVarausjaksoihin", "Takaisin varausjaksoihin")}
				</BackLink>
				<EmptyState
					title={t("varausjaksoaEiLytynyt", "Varausjaksoa ei löytynyt.")}
				/>
			</PageContainer>
		);
	}

	if (isLoading || !block) {
		return (
			<PageContainer width="default">
				<p className="text-sm text-stone-600 dark:text-stone-400">
					{t("ladataanVarausjaksoa", "Ladataan varausjaksoa...")}
				</p>
			</PageContainer>
		);
	}

	const resourceMap = new Map(resources?.map((r) => [r.id, r.name]));

	const rrule = block.rrule;
	const handleDetach = async (occurrenceId: string) => {
		const occurrence = block.occurrences.find((o) => o.id === occurrenceId);
		if (!rrule || !occurrence) return;
		const created = await splitBlock.mutateAsync({
			id,
			...planSplit(rrule, block.occurrences, occurrence),
		});
		navigate({
			to: "/reservable-blocks/edit/$id",
			params: { id: created.id },
		});
	};

	const handleDelete = async () => {
		if (
			confirm(
				t(
					"vahvistaVarausjaksonPoisto",
					"Haluatko varmasti poistaa tämän varausjakson? Jo tehdyt varaukset säilyvät.",
				),
			)
		) {
			await deleteBlock.mutateAsync(id);
			navigate({ to: "/reservable-blocks" });
		}
	};

	return (
		<DetailLayout
			back={
				<BackLink to="/reservable-blocks">
					{t("takaisinVarausjaksoihin", "Takaisin varausjaksoihin")}
				</BackLink>
			}
			title={block.title}
			subtitle={block.description ?? undefined}
			actions={
				isAdmin && (
					<Button variant="outline" asChild>
						<Link to="/reservable-blocks/edit/$id" params={{ id }}>
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
						disabled={deleteBlock.isPending}
					>
						<Trash2 size={16} />
						{t("poista", "Poista")}
					</Button>
				)
			}
			technical={{
				id: block.id,
				createdAt: block.created_at,
				updatedAt: block.updated_at,
			}}
		>
			<section className="space-y-3">
				<h2 className="text-lg font-semibold">
					{t("varausjaksonAjat", "Ajat ({{count}})", {
						count: block.occurrences.length,
					})}
				</h2>
				<OccurrenceListCollapsible
					items={block.occurrences.map((occ) => ({
						id: occ.id,
						start_time: occ.start_time,
						end_time: occ.end_time,
						groupLabel: resourceMap.get(occ.resource_id) || occ.resource_id,
						reserved: occ.reserved,
						canDetach:
							isAdmin && canSplitOccurrence(rrule, block.occurrences, occ),
					}))}
					onDetach={handleDetach}
					detachDisabled={splitBlock.isPending}
				/>
			</section>
		</DetailLayout>
	);
}
