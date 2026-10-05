import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Calendar,
	CalendarCheck,
	ChevronLeft,
	ChevronRight,
	Clock,
	Edit,
	Eye,
	Loader2,
	Plus,
	Trash2,
} from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useIsAdmin } from "#/hooks/useAuth";
import {
	type ReservableBlockWithOccurrences,
	useDeleteReservableBlock,
	useReservableBlocks,
} from "#/hooks/useReservableBlocks";
import { useResources } from "#/hooks/useResorces";
import { requireAuthGuard } from "#/utils/authGuard";
import {
	addDays,
	formatYYYYMMDD,
	localDayRangeISO,
	parseLocalDate,
	startOfWeek,
	useDateFormatter,
} from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export interface ReservableBlocksSearch {
	start_date?: string;
	days?: number;
	resource_id?: string;
}

export const Route = createFileRoute("/_app/reservable-blocks/")({
	validateSearch: (
		search: Record<string, unknown>,
	): ReservableBlocksSearch => ({
		start_date:
			typeof search.start_date === "string" ? search.start_date : undefined,
		days: typeof search.days === "number" ? search.days : undefined,
		resource_id:
			typeof search.resource_id === "string" ? search.resource_id : undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: ReservableBlocksPage,
});

function BlockCard({
	item,
	resourceNames,
	onDelete,
	isDeleting,
	isAdmin,
}: {
	item: ReservableBlockWithOccurrences;
	resourceNames: Map<string, string>;
	onDelete: (id: string) => void;
	isDeleting: boolean;
	isAdmin: boolean;
}) {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();

	const firstOcc = item.occurrences[0];
	const resources = Array.from(
		new Set(
			item.occurrences.map(
				(o) => resourceNames.get(o.resource_id) ?? o.resource_id,
			),
		),
	).join(", ");

	return (
		<li className="p-3 border-2 border-emerald-300 dark:border-emerald-900/60 flex flex-col justify-between gap-3 rounded-sm bg-stone-50 dark:bg-stone-900 min-w-0">
			<div className="flex items-start justify-between gap-2 min-w-0">
				<Link
					to="/reservable-blocks/$id"
					params={{ id: item.id }}
					className="font-bold truncate hover:underline text-stone-900 dark:text-stone-100 flex-1 flex items-center gap-1.5"
				>
					<CalendarCheck size={16} className="text-emerald-600 shrink-0" />
					<span className="truncate">{item.title}</span>
				</Link>
				<Chip>{readable_uuid(item.id)}</Chip>
			</div>

			{firstOcc ? (
				<div className="flex items-center gap-1 text-xs font-mono text-stone-600 dark:text-stone-300">
					<Calendar size={14} className="text-emerald-600 shrink-0" />
					<span>
						{formatDate(firstOcc.start_time)}
						{" →"} {formatDate(firstOcc.end_time)}
					</span>
					{item.occurrences.length > 1 && (
						<span className="text-[10px] font-sans px-1 rounded bg-emerald-200 dark:bg-emerald-950 font-bold ml-auto">
							{"+"}
							{item.occurrences.length - 1}
						</span>
					)}
				</div>
			) : (
				<div className="text-xs text-stone-400 italic">
					{t("eiAikoja", "Ei aikoja")}
				</div>
			)}

			<div className="truncate text-xs text-stone-500 dark:text-stone-400 pt-1 border-t border-stone-200 dark:border-stone-800">
				{resources}
			</div>

			<div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800">
				<div className="flex items-center gap-1">
					<Button variant="secondary" size="sm" asChild>
						<Link
							to="/reservable-blocks/$id"
							params={{ id: item.id }}
							className="gap-1 text-xs"
						>
							<Eye size={14} />
							<span>{t("nayta", "Näytä")}</span>
						</Link>
					</Button>
					{isAdmin && (
						<Button variant="outline" size="sm" asChild>
							<Link
								to="/reservable-blocks/edit/$id"
								params={{ id: item.id }}
								className="gap-1 text-xs"
							>
								<Edit size={14} />
								<span>{t("muokkaa", "Muokkaa")}</span>
							</Link>
						</Button>
					)}
				</div>

				{isAdmin && (
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
				)}
			</div>
		</li>
	);
}

function ReservableBlocksPage() {
	const { t } = useTranslation();
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { isAdmin } = useIsAdmin();

	const { data: resources, isLoading: loadingResources } = useResources();
	const deleteBlock = useDeleteReservableBlock();

	const startStr = search.start_date || formatYYYYMMDD(startOfWeek());
	const days = search.days || 30;
	const resourceId = search.resource_id;
	const start = useMemo(() => parseLocalDate(startStr), [startStr]);

	const { startISO, endISO } = useMemo(
		() => localDayRangeISO(start, addDays(start, days - 1)),
		[start, days],
	);

	const {
		data: blocks,
		isLoading,
		isError,
	} = useReservableBlocks({
		start_date: startISO,
		end_date: endISO,
		resource_id: resourceId,
	});

	const resourceNames = useMemo(
		() => new Map(resources?.map((r) => [r.id, r.name])),
		[resources],
	);
	const blockResources = resources?.filter((r) => r.blocks_only);

	const updateSearch = (next: ReservableBlocksSearch) => {
		navigate({ search: (prev) => ({ ...prev, ...next }), replace: true });
	};

	const moveStart = (deltaDays: number) => {
		updateSearch({ start_date: formatYYYYMMDD(addDays(start, deltaDays)) });
	};

	const handleDelete = async (id: string) => {
		if (
			confirm(
				t(
					"vahvistaVarausjaksonPoisto",
					"Haluatko varmasti poistaa tämän varausjakson? Jo tehdyt varaukset säilyvät.",
				),
			)
		) {
			await deleteBlock.mutateAsync(id);
		}
	};

	return (
		<div className="flex flex-col gap-6 p-4 flex-1 min-h-0">
			<div className="flex items-center justify-between gap-4 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100 flex items-center gap-2">
					<CalendarCheck
						className="text-emerald-600 dark:text-emerald-500"
						size={22}
					/>
					<span>{t("varausjaksot", "Varausjaksot")}</span>
				</h1>

				{isAdmin && (
					<Link to="/reservable-blocks/create">
						<Button
							size="sm"
							className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
						>
							<Plus size={16} />
							<span>{t("uusiVarausjakso", "Uusi varausjakso")}</span>
						</Button>
					</Link>
				)}
			</div>

			<div className="flex flex-wrap items-center gap-2 shrink-0 p-2 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
				<Button variant="secondary" size="sm" onClick={() => moveStart(-days)}>
					<ChevronLeft size={18} />
				</Button>

				<input
					type="date"
					value={formatYYYYMMDD(start)}
					onChange={(e) =>
						e.target.value && updateSearch({ start_date: e.target.value })
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
					{blockResources?.map((res) => (
						<option key={res.id} value={res.id}>
							{res.name}
						</option>
					))}
				</select>
			</div>

			{isLoading ? (
				<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
					<Loader2 className="animate-spin" size={18} />
					<span>{t("ladataanVarausjaksoja", "Ladataan varausjaksoja...")}</span>
				</div>
			) : isError ? (
				<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
					{t(
						"virheLadattaessaVarausjaksoja",
						"Virhe ladattaessa varausjaksoja.",
					)}
				</div>
			) : (
				<div className="space-y-4">
					<div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-500 font-bold">
						<Clock size={18} />
						<h2>
							{t("varausjaksoja", "Varausjaksoja ({{count}})", {
								count: blocks?.length ?? 0,
							})}
						</h2>
					</div>

					{blocks && blocks.length > 0 ? (
						<ul className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3">
							{blocks.map((block) => (
								<BlockCard
									key={block.id}
									item={block}
									resourceNames={resourceNames}
									onDelete={handleDelete}
									isDeleting={deleteBlock.isPending}
									isAdmin={isAdmin}
								/>
							))}
						</ul>
					) : (
						<div className="p-4 text-xs text-stone-500 bg-stone-50 dark:bg-stone-900/40 rounded-md border border-stone-200 dark:border-stone-800">
							{t(
								"eiVarausjaksojaValitullaAikavalilla",
								"Ei varausjaksoja valitulla aikavälillä.",
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
