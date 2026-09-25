import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertOctagon,
	Calendar,
	ChevronLeft,
	ChevronRight,
	Clock,
	Edit,
	Eye,
	Loader2,
	Plus,
	Trash2,
	Users,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useGroups } from "#/hooks/useGroups";
import {
	type RestrictionWithOccurrences,
	useDeleteRestriction,
	useRestrictions,
} from "#/hooks/useRestrictions";
import { useResources } from "#/hooks/useResorces";
import { requireAuthGuard } from "#/utils/authGuard";
import { startOfCurrentWeek } from "#/utils/calendarUtils";
import { formatDate } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export interface RestrictionsDashboardSearch {
	start_date?: string;
	days?: number;
	resource_id?: string;
}

const formatYYYYMMDD = (d: Date) => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const parseLocalDate = (dateStr: string): Date => {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day, 0, 0, 0, 0);
};

export const Route = createFileRoute("/_app/restrictions/")({
	validateSearch: (
		search: Record<string, unknown>,
	): RestrictionsDashboardSearch => {
		return {
			start_date:
				typeof search.start_date === "string" ? search.start_date : undefined,
			days: typeof search.days === "number" ? search.days : undefined,
			resource_id:
				typeof search.resource_id === "string" ? search.resource_id : undefined,
		};
	},
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: RestrictionsDashboardPage,
});

function RestrictionCard({
	item,
	onDelete,
	isDeleting,
}: {
	item: RestrictionWithOccurrences;
	onDelete: (id: string) => void;
	isDeleting: boolean;
}) {
	const { t } = useTranslation();
	const { data: resources } = useResources();
	const { data: groups } = useGroups();

	const resourceMap = useMemo(
		() => new Map(resources?.map((r) => [r.id, r.name])),
		[resources],
	);
	const groupMap = useMemo(
		() => new Map(groups?.map((g) => [g.id, g.name])),
		[groups],
	);

	const occurrences = item.occurrences || [];
	const firstOcc = occurrences[0];

	const exemptGroupNames =
		item.exempt_group_ids.length > 0
			? item.exempt_group_ids.map((gId) => groupMap.get(gId) || gId).join(", ")
			: t("eiPoikkeuksia", "Ei sallittuja ryhmiä");

	return (
		<li className="p-3 border-2 border-amber-300 dark:border-amber-900/60 flex flex-col justify-between gap-3 rounded-sm bg-stone-50 dark:bg-stone-900 transition-colors min-w-0">
			<div className="flex items-start justify-between gap-2 min-w-0">
				<Link
					to="/restrictions/$id"
					params={{ id: item.id }}
					className="font-bold truncate hover:underline text-stone-900 dark:text-stone-100 flex-1 flex items-center gap-1.5"
				>
					<AlertOctagon size={16} className="text-amber-600 shrink-0" />
					<span className="truncate">{item.title}</span>
				</Link>
				<Chip>{readable_uuid(item.id)}</Chip>
			</div>

			{/* First Occurrence Preview */}
			{firstOcc ? (
				<div className="flex items-center gap-1 text-xs font-mono text-stone-600 dark:text-stone-300">
					<Calendar size={14} className="text-amber-600 shrink-0" />
					<span>
						{formatDate(firstOcc.start_time)} &rarr;{" "}
						{formatDate(firstOcc.end_time)}
					</span>
					{occurrences.length > 1 && (
						<span className="text-[10px] font-sans px-1 rounded bg-amber-200 dark:bg-amber-950 font-bold ml-auto">
							+{occurrences.length - 1}
						</span>
					)}
				</div>
			) : (
				<div className="text-xs text-stone-400 italic">
					{t("eiAikoja", "Ei aikoja")}
				</div>
			)}

			{/* Exemptions info */}
			<div className="truncate text-xs text-stone-500 dark:text-stone-400 flex items-center gap-1 pt-1 border-t border-stone-200 dark:border-stone-800">
				<Users size={12} className="text-emerald-600 shrink-0" />
				<span className="truncate">{exemptGroupNames}</span>
			</div>

			{/* Card actions */}
			<div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
				<div className="flex items-center gap-1">
					<Button variant="secondary" size="sm" asChild>
						<Link
							to="/restrictions/$id"
							params={{ id: item.id }}
							className="gap-1 text-xs"
						>
							<Eye size={14} />
							<span>{t("nayta", "Näytä")}</span>
						</Link>
					</Button>
					<Button variant="outline" size="sm" asChild>
						<Link
							to="/restrictions/edit/$id"
							params={{ id: item.id }}
							className="gap-1 text-xs"
						>
							<Edit size={14} />
							<span>{t("muokkaa", "Muokkaa")}</span>
						</Link>
					</Button>
				</div>

				<Button
					variant="outline"
					size="sm"
					disabled={isDeleting}
					onClick={() => onDelete(item.id)}
					className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 text-xs px-2.5 py-1 gap-1"
				>
					<Trash2 size={14} />
					<span>{t("poista", "Poista")}</span>
				</Button>
			</div>
		</li>
	);
}

function RestrictionsDashboardPage() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const { data: resources, isLoading: loadingResources } = useResources();
	const deleteRestriction = useDeleteRestriction();

	const defaultStartStr = formatYYYYMMDD(startOfCurrentWeek());
	const startStr = search.start_date || defaultStartStr;
	const days = search.days || 30;
	const resourceId = search.resource_id;

	const start = useMemo(() => parseLocalDate(startStr), [startStr]);

	const { startDateISO, endDateISO } = useMemo(() => {
		const startDate = new Date(start);
		startDate.setHours(0, 0, 0, 0);

		const endDate = new Date(start);
		endDate.setDate(endDate.getDate() + days);
		endDate.setHours(23, 59, 59, 999);

		return {
			startDateISO: startDate.toISOString(),
			endDateISO: endDate.toISOString(),
		};
	}, [start, days]);

	const {
		data: restrictions,
		isLoading,
		isError,
	} = useRestrictions({
		start_date: startDateISO,
		end_date: endDateISO,
		resource_id: resourceId,
	});

	const updateSearch = (next: RestrictionsDashboardSearch) => {
		navigate({
			search: (prev) => ({ ...prev, ...next }),
			replace: true,
		});
	};

	const moveStart = (deltaDays: number) => {
		const next = new Date(start);
		next.setDate(next.getDate() + deltaDays);
		updateSearch({ start_date: formatYYYYMMDD(next) });
	};

	const handleDelete = async (id: string) => {
		if (
			confirm(
				t("vahvistaPoisto", "Haluatko varmasti poistaa tämän rajoituksen?"),
			)
		) {
			await deleteRestriction.mutateAsync(id);
		}
	};

	return (
		<div className="flex flex-col gap-6 p-4 flex-1 min-h-0">
			<div className="flex items-center justify-between gap-4 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
					<AlertOctagon
						className="text-amber-600 dark:text-amber-500"
						size={22}
					/>
					<span>{t("aikarajoitukset", "Aikarajoitukset")}</span>
				</h1>

				<Link to="/restrictions/create">
					<Button
						size="sm"
						className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
					>
						<Plus size={16} />
						<span>{t("uusiRajoitus", "Uusi rajoitus")}</span>
					</Button>
				</Link>
			</div>

			{/* Controls Bar */}
			<div className="flex flex-wrap items-center gap-2 shrink-0 p-2 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
				<Button variant="secondary" size="sm" onClick={() => moveStart(-days)}>
					<ChevronLeft size={18} />
				</Button>

				<input
					type="date"
					value={formatYYYYMMDD(start)}
					onChange={(e) =>
						e.target.valueAsDate &&
						updateSearch({ start_date: formatYYYYMMDD(e.target.valueAsDate) })
					}
					className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-mono"
				/>

				<Button variant="secondary" size="sm" onClick={() => moveStart(days)}>
					<ChevronRight size={18} />
				</Button>

				<select
					value={days}
					onChange={(e) => updateSearch({ days: Number(e.target.value) })}
					className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-medium"
				>
					<option value={14}>{t("2Viikkoa", "2 viikkoa")}</option>
					<option value={30}>{t("1Kuukausi", "1 kuukausi")}</option>
					<option value={90}>{t("3Kuukautta", "3 kuukautta")}</option>
				</select>

				<select
					value={resourceId || ""}
					onChange={(e) =>
						updateSearch({ resource_id: e.target.value || undefined })
					}
					disabled={loadingResources}
					className="px-3 py-1.5 text-xs bg-stone-50 dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md font-medium max-w-full truncate"
				>
					<option value="">{t("kaikkiResurssit", "Kaikki resurssit")}</option>
					{resources?.map((res) => (
						<option key={res.id} value={res.id}>
							{res.name}
						</option>
					))}
				</select>
			</div>

			{isLoading ? (
				<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
					<Loader2 className="animate-spin" size={18} />
					<span>{t("ladataanRajoituksia", "Ladataan rajoituksia...")}</span>
				</div>
			) : isError ? (
				<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
					{t("virheLadattaessaRajoituksia", "Virhe ladattaessa rajoituksia.")}
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center gap-2 text-amber-600 dark:text-amber-500 font-bold">
						<Clock size={18} />
						<h2>
							{t(
								"voimassaOlevatRajoitukset",
								"Voimassa olevat rajoitukset ({{count}})",
								{
									count: restrictions?.length ?? 0,
								},
							)}
						</h2>
					</div>

					{restrictions && restrictions.length > 0 ? (
						<ul className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
							{restrictions.map((res) => (
								<RestrictionCard
									key={res.id}
									item={res}
									onDelete={handleDelete}
									isDeleting={deleteRestriction.isPending}
								/>
							))}
						</ul>
					) : (
						<div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
							{t(
								"eiRajoituksiaValitullaAikavlill",
								"Ei aktiivisia aikarajoituksia valitulla aikavälillä.",
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
