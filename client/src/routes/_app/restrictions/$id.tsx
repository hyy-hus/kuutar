import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	AlertOctagon,
	ArrowLeft,
	Clock,
	Edit,
	Trash2,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useGroups } from "#/hooks/useGroups";
import { useDeleteRestriction, useRestriction } from "#/hooks/useRestrictions";
import { useResources } from "#/hooks/useResorces";
import { formatDate } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/restrictions/$id")({
	component: ViewRestrictionPage,
});

function ViewRestrictionPage() {
	const { t } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();

	const isValidUuid = Boolean(id && id.length > 8);

	const {
		data: restrictionWithOcc,
		isLoading,
		isError,
	} = useRestriction(isValidUuid ? id : "");
	const { data: resources } = useResources();
	const { data: groups } = useGroups();
	const deleteRestriction = useDeleteRestriction();

	if (!isValidUuid || isError || (!isLoading && !restrictionWithOcc)) {
		return (
			<div className="p-8 text-center text-stone-500">
				<p>{t("rajoitustaEiLytynyt", "Rajoitusta ei löytynyt.")}</p>
				<Link
					to="/admin/dashboard"
					className="text-amber-600 hover:underline text-xs mt-2 inline-block"
				>
					{t("palaaHallintapaneeliin", "Palaa hallintapaneeliin")}
				</Link>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="p-8 text-xs text-stone-500">
				{t("ladataanRajoitusta", "Ladataan rajoitusta...")}
			</div>
		);
	}

	const resourceMap = new Map(resources?.map((r) => [r.id, r.name]));
	const groupMap = new Map(groups?.map((g) => [g.id, g.name]));

	const occurrences = restrictionWithOcc.occurrences || [];

	const exemptGroups =
		restrictionWithOcc.exempt_group_ids.length > 0
			? restrictionWithOcc.exempt_group_ids
				.map((gId) => groupMap.get(gId) || gId)
				.join(", ")
			: t("eiPoikkeuksia", "Ei sallittuja ryhmiä (kaikki estetyn piirissä)");

	const handleDelete = async () => {
		if (
			confirm(
				t("vahvistaPoisto", "Haluatko varmasti poistaa tämän rajoituksen?"),
			)
		) {
			await deleteRestriction.mutateAsync(id);
			navigate({ to: "/admin/dashboard" });
		}
	};

	return (
		<div className="max-w-2xl mx-auto p-4 space-y-6">
			{/* Top Nav */}
			<div className="flex items-center justify-between">
				<Link
					to="/admin/dashboard"
					className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
				>
					<ArrowLeft size={14} />
					<span>{t("palaaHallintaan", "Palaa hallintapaneeliin")}</span>
				</Link>

				<div className="flex items-center gap-2">
					<Link to="/restrictions/edit/$id" params={{ id }}>
						<Button variant="outline" size="sm" className="gap-1 text-xs">
							<Edit size={14} />
							<span>{t("muokkaa", "Muokkaa")}</span>
						</Button>
					</Link>
					<Button
						variant="outline"
						size="sm"
						onClick={handleDelete}
						disabled={deleteRestriction.isPending}
						className="gap-1 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
					>
						<Trash2 size={14} />
						<span>{t("poista", "Poista")}</span>
					</Button>
				</div>
			</div>

			{/* Main Card */}
			<div className="p-5 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900 space-y-4">
				<div className="flex items-start justify-between gap-3">
					<div>
						<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
							<AlertOctagon
								size={20}
								className="text-amber-600 dark:text-amber-500"
							/>
							<span>{restrictionWithOcc.title}</span>
						</h1>
						{restrictionWithOcc.description && (
							<p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
								{restrictionWithOcc.description}
							</p>
						)}
					</div>
					<Chip>{readable_uuid(restrictionWithOcc.id)}</Chip>
				</div>

				{/* Occurrences List */}
				<div className="space-y-2">
					<span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
						{t("rajoitetutAjanjaksot", "Rajoitetut ajanjaksot ({{count}})", {
							count: occurrences.length,
						})}
					</span>

					<div className="space-y-1.5 max-h-60 overflow-y-auto">
						{occurrences.map((occ) => {
							const resName = occ.resource_id
								? resourceMap.get(occ.resource_id) || occ.resource_id
								: t("kaikkiResurssitGlobaali", "Kaikki resurssit (globaali)");

							return (
								<div
									key={occ.id}
									className="flex flex-wrap items-center justify-between gap-2 p-2 bg-stone-100 dark:bg-stone-800/60 rounded border border-stone-200 dark:border-stone-800 text-xs font-mono"
								>
									<div className="flex items-center gap-1.5 text-stone-800 dark:text-stone-200">
										<Clock size={14} className="text-amber-600 shrink-0" />
										<span>
											{formatDate(occ.start_time)} &rarr;{" "}
											{formatDate(occ.end_time)}
										</span>
									</div>
									<span className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
										{resName}
									</span>
								</div>
							);
						})}
					</div>
				</div>

				{/* Group Exemptions */}
				<div className="flex items-start gap-1 text-xs pt-2 border-t border-stone-200 dark:border-stone-800">
					<Users
						size={14}
						className="text-emerald-600 dark:text-emerald-500 shrink-0 mt-0.5"
					/>
					<div>
						<span className="font-semibold text-stone-700 dark:text-stone-300">
							{t("sallitutRyhmat", "Sallitut käyttäjäryhmät")}:{" "}
						</span>
						<span className="text-stone-900 dark:text-stone-100">
							{exemptGroups}
						</span>
					</div>
				</div>
			</div>
		</div>
	);
}
