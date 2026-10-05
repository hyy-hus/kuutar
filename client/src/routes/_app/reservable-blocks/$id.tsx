import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CalendarCheck, Clock, Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useIsAdmin } from "#/hooks/useAuth";
import {
	useDeleteReservableBlock,
	useReservableBlock,
} from "#/hooks/useReservableBlocks";
import { useResources } from "#/hooks/useResorces";
import { useDateFormatter } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/reservable-blocks/$id")({
	component: ViewReservableBlockPage,
});

function ViewReservableBlockPage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
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

	if (!isValidUuid || isError || (!isLoading && !block)) {
		return (
			<div className="p-8 text-center text-stone-500">
				<p>{t("varausjaksoaEiLytynyt", "Varausjaksoa ei löytynyt.")}</p>
				<Link
					to="/reservable-blocks"
					className="text-emerald-600 hover:underline text-xs mt-2 inline-block"
				>
					{t("takaisinVarausjaksoihin", "Takaisin varausjaksoihin")}
				</Link>
			</div>
		);
	}

	if (isLoading || !block) {
		return (
			<div className="p-8 text-xs text-stone-500">
				{t("ladataanVarausjaksoa", "Ladataan varausjaksoa...")}
			</div>
		);
	}

	const resourceMap = new Map(resources?.map((r) => [r.id, r.name]));

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
		<div className="max-w-2xl mx-auto p-4 space-y-6">
			<div className="flex items-center justify-between">
				<Link
					to="/reservable-blocks"
					className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
				>
					<ArrowLeft size={14} />
					<span>
						{t("takaisinVarausjaksoihin", "Takaisin varausjaksoihin")}
					</span>
				</Link>

				{isAdmin && (
					<div className="flex items-center gap-2">
						<Link to="/reservable-blocks/edit/$id" params={{ id }}>
							<Button variant="outline" size="sm" className="gap-1 text-xs">
								<Edit size={14} />
								<span>{t("muokkaa", "Muokkaa")}</span>
							</Button>
						</Link>
						<Button
							variant="outline"
							size="sm"
							onClick={handleDelete}
							disabled={deleteBlock.isPending}
							className="gap-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
						>
							<Trash2 size={14} />
							<span>{t("poista", "Poista")}</span>
						</Button>
					</div>
				)}
			</div>

			<div className="p-5 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900 space-y-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
							<CalendarCheck
								size={20}
								className="text-emerald-600 dark:text-emerald-500"
							/>
							<span>{block.title}</span>
						</h1>
						{block.description && (
							<p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
								{block.description}
							</p>
						)}
					</div>
					<Chip>{readable_uuid(block.id)}</Chip>
				</div>

				<div className="space-y-2">
					<span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
						{t("varausjaksonAjat", "Ajat ({{count}})", {
							count: block.occurrences.length,
						})}
					</span>

					<div className="space-y-1.5 max-h-60 overflow-y-auto">
						{block.occurrences.map((occ) => (
							<div
								key={occ.id}
								className="flex flex-wrap items-center justify-between gap-2 p-2 bg-stone-100 dark:bg-stone-800/60 rounded border border-stone-200 dark:border-stone-800 text-xs font-mono"
							>
								<div className="flex items-center gap-1.5 text-stone-800 dark:text-stone-200">
									<Clock size={14} className="text-emerald-600 shrink-0" />
									<span>
										{formatDate(occ.start_time)}
										{" →"} {formatDate(occ.end_time)}
									</span>
								</div>
								<div className="flex items-center gap-1.5">
									{occ.reserved && (
										<span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-200">
											{t("varattu", "Varattu")}
										</span>
									)}
									<span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
										{resourceMap.get(occ.resource_id) || occ.resource_id}
									</span>
								</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
