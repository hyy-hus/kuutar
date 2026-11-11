import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowDown,
	ArrowUp,
	ArrowUpDown,
	FileSpreadsheet,
	Loader2,
	Plus,
	Search,
	Shield,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EmptyState } from "#/components/EmptyState";
import { FilterBar } from "#/components/FilterBar";
import { Input } from "#/components/Input";
import { LANGUAGE_LABELS } from "#/components/LanguageSelect";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { Select } from "#/components/Select";
import { StatusChip } from "#/components/StatusChip";
import { useIsAdmin } from "#/hooks/useAuth";
import { useGroups } from "#/hooks/useGroups";
import { useBulkUpdateUsers, useUsers } from "#/hooks/useUsers";
import { requireAdminGuard } from "#/utils/authGuard";
import { cn } from "#/utils/cn";

export const Route = createFileRoute("/_app/admin/users/")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: UserList,
});

type SortKey = "name" | "group" | "language";
const PAGE_SIZE = 50;

function SortHeader({
	label,
	column,
	sort,
	onSort,
	className,
}: {
	label: string;
	column: SortKey;
	sort: { key: SortKey; dir: "asc" | "desc" };
	onSort: (key: SortKey) => void;
	className?: string;
}) {
	const active = sort.key === column;
	const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
	return (
		<th
			scope="col"
			aria-sort={
				active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
			}
			className={cn("px-3 py-2 text-left font-normal", className)}
		>
			<button
				type="button"
				onClick={() => onSort(column)}
				className="focus-ring inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider hover:text-stone-900 dark:hover:text-stone-100"
			>
				{label}
				<Icon
					size={12}
					aria-hidden="true"
					className={cn(!active && "opacity-50")}
				/>
			</button>
		</th>
	);
}

function UserList() {
	const { t, i18n } = useTranslation();
	const { isAdmin } = useIsAdmin();
	const {
		data: users,
		isLoading: loadingUsers,
		isError: errorUsers,
	} = useUsers();
	const { data: groups, isLoading: loadingGroups } = useGroups();
	const bulkUpdate = useBulkUpdateUsers();
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [targetGroupId, setTargetGroupId] = useState("");
	const [targetLanguage, setTargetLanguage] = useState("");
	const [bulkErrors, setBulkErrors] = useState<string[]>([]);
	const [query, setQuery] = useState("");
	const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
		key: "name",
		dir: "asc",
	});
	const [limit, setLimit] = useState(PAGE_SIZE);

	const groupsMap = useMemo(
		() => new Map(groups?.map((g) => [g.id, g.name])),
		[groups],
	);

	const rows = useMemo(() => {
		const needle = query.trim().toLowerCase();
		const collator = new Intl.Collator(i18n.language, { sensitivity: "base" });
		const keyOf = (u: NonNullable<typeof users>[number]) =>
			sort.key === "group"
				? (groupsMap.get(u.group_id) ?? "")
				: sort.key === "language"
					? u.language
					: u.name || u.email;
		return (users ?? [])
			.filter(
				(u) =>
					!needle ||
					u.name.toLowerCase().includes(needle) ||
					u.email.toLowerCase().includes(needle) ||
					(groupsMap.get(u.group_id) ?? "").toLowerCase().includes(needle),
			)
			.sort(
				(a, b) =>
					(sort.dir === "asc" ? 1 : -1) * collator.compare(keyOf(a), keyOf(b)),
			);
	}, [users, query, sort, groupsMap, i18n.language]);

	// Drop selections for users that no longer exist (e.g. after a refetch)
	const selectedUsers = useMemo(
		() => (users ?? []).filter((u) => selectedIds.has(u.id)),
		[users, selectedIds],
	);

	if (loadingUsers || loadingGroups) {
		return (
			<div className="flex items-center gap-2 py-8 text-stone-600 dark:text-stone-400">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanKyttji", "Ladataan käyttäjiä...")}</span>
			</div>
		);
	}

	if (errorUsers) {
		return (
			<Callout variant="danger">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</Callout>
		);
	}

	const visibleRows = rows.slice(0, limit);
	const allFilteredSelected =
		rows.length > 0 && rows.every((u) => selectedIds.has(u.id));
	const canApply =
		selectedUsers.length > 0 &&
		(targetGroupId !== "" || targetLanguage !== "") &&
		!bulkUpdate.isPending;

	const toggleSort = (key: SortKey) =>
		setSort((prev) =>
			prev.key === key
				? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
				: { key, dir: "asc" },
		);

	const toggleUser = (id: string) =>
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (!next.delete(id)) next.add(id);
			return next;
		});

	const toggleAllFiltered = () =>
		setSelectedIds((prev) => {
			const next = new Set(prev);
			for (const u of rows) {
				if (allFilteredSelected) next.delete(u.id);
				else next.add(u.id);
			}
			return next;
		});

	const handleApply = async () => {
		setBulkErrors([]);
		try {
			await bulkUpdate.mutateAsync({
				users: selectedUsers,
				changes: {
					group_id: targetGroupId || undefined,
					language: targetLanguage || undefined,
				},
			});
			setSelectedIds(new Set());
			setTargetGroupId("");
			setTargetLanguage("");
		} catch (err) {
			setBulkErrors((err as Error).message.split("\n"));
		}
	};

	const checkboxClass = "h-4 w-4 cursor-pointer accent-purple-600";

	return (
		<PageContainer>
			<PageHeader
				title={t("kyttjt", "Käyttäjät")}
				subtitle={t("yhteensaKayttajia", "Yhteensä {{count}} käyttäjää", {
					count: users?.length ?? 0,
				})}
				actions={
					isAdmin && (
						<>
							<Button asChild>
								<Link to="/admin/users/create">
									<Plus size={16} />
									<span>{t("rekisteriKyttj", "Rekisteröi käyttäjä")}</span>
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link to="/admin/users/batch-register">
									<FileSpreadsheet size={16} />
									<span>{t("massaRekisterointi", "Massarekisteröinti")}</span>
								</Link>
							</Button>
						</>
					)
				}
			/>

			<FilterBar>
				<div className="relative w-full max-w-sm">
					<Search
						size={14}
						aria-hidden="true"
						className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-600 dark:text-stone-400"
					/>
					<Input
						type="search"
						size="sm"
						value={query}
						onChange={(e) => {
							setQuery(e.target.value);
							setLimit(PAGE_SIZE);
						}}
						aria-label={t("haeKayttajia", "Hae käyttäjiä")}
						placeholder={t(
							"haeKayttajiaPlaceholder",
							"Hae nimellä, sähköpostilla tai ryhmällä",
						)}
						className="pl-8"
					/>
				</div>
				<span className="text-xs text-stone-600 dark:text-stone-400">
					{t("naytetaanMaara", "Näytetään {{shown}} / {{total}}", {
						shown: Math.min(limit, rows.length),
						total: rows.length,
					})}
				</span>
			</FilterBar>

			{isAdmin && selectedUsers.length > 0 && (
				<section
					aria-label={t("massamuutokset", "Massamuutokset")}
					className="space-y-2 rounded-md border-2 border-stone-800 bg-stone-50 p-3 dark:border-stone-300 dark:bg-stone-900"
				>
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm font-medium">
							{t("valittuMaara", "{{count}} valittu", {
								count: selectedUsers.length,
							})}
						</span>
						<Select
							size="sm"
							wrapperClassName="w-auto"
							aria-label={t("siirraRyhmaan", "Siirrä ryhmään")}
							value={targetGroupId}
							onChange={(e) => setTargetGroupId(e.target.value)}
						>
							<option value="">
								{t("siirraRyhmaanPlaceholder", "-- Siirrä ryhmään --")}
							</option>
							{groups?.map((g) => (
								<option key={g.id} value={g.id}>
									{g.name}
								</option>
							))}
						</Select>
						<LanguageSelectWithPlaceholder
							value={targetLanguage}
							onChange={setTargetLanguage}
							label={t("asetaKieli", "Aseta kieli")}
							placeholder={t("asetaKieliPlaceholder", "-- Aseta kieli --")}
						/>
						<Button size="sm" disabled={!canApply} onClick={handleApply}>
							{bulkUpdate.isPending && (
								<Loader2 className="animate-spin" size={14} />
							)}
							<span>{t("toteutaMuutokset", "Toteuta muutokset")}</span>
						</Button>
						<Button
							size="sm"
							variant="ghost"
							onClick={() => setSelectedIds(new Set())}
						>
							{t("tyhjennaValinta", "Tyhjennä valinta")}
						</Button>
					</div>
					{bulkErrors.length > 0 && (
						<ul className="list-disc pl-5 text-xs text-red-600 dark:text-red-400">
							{bulkErrors.map((e) => (
								<li key={e}>{e}</li>
							))}
						</ul>
					)}
				</section>
			)}

			{rows.length === 0 ? (
				<EmptyState title={t("eiHakutuloksia", "Ei hakutuloksia")} />
			) : (
				<div className="overflow-x-auto rounded-md border-2 border-stone-800 bg-stone-50 dark:border-stone-300 dark:bg-stone-900">
					<table className="w-full text-sm">
						<thead className="sticky top-0 bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300">
							<tr className="border-b border-stone-300 dark:border-stone-700">
								{isAdmin && (
									<th scope="col" className="w-10 px-3 py-2">
										<input
											type="checkbox"
											checked={allFilteredSelected}
											onChange={toggleAllFiltered}
											aria-label={t("valitseKaikki", "Valitse kaikki")}
											className={checkboxClass}
										/>
									</th>
								)}
								<SortHeader
									label={t("nimi", "Nimi")}
									column="name"
									sort={sort}
									onSort={toggleSort}
								/>
								<SortHeader
									label={t("ryhm", "Ryhmä")}
									column="group"
									sort={sort}
									onSort={toggleSort}
									className="hidden sm:table-cell"
								/>
								<SortHeader
									label={t("kieli", "Kieli")}
									column="language"
									sort={sort}
									onSort={toggleSort}
									className="hidden md:table-cell"
								/>
							</tr>
						</thead>
						<tbody className="divide-y divide-stone-200 dark:divide-stone-800">
							{visibleRows.map((u) => (
								<tr
									key={u.id}
									className="hover:bg-stone-100 dark:hover:bg-stone-800/60"
								>
									{isAdmin && (
										<td className="px-3 py-2">
											<input
												type="checkbox"
												checked={selectedIds.has(u.id)}
												onChange={() => toggleUser(u.id)}
												aria-label={t("valitseKayttaja", "Valitse {{name}}", {
													name: u.name || u.email,
												})}
												className={checkboxClass}
											/>
										</td>
									)}
									<td className="min-w-0 px-3 py-2">
										<div className="flex flex-wrap items-center gap-x-2">
											<Link
												to="/admin/users/$id"
												params={{ id: u.id }}
												className="focus-ring font-medium text-purple-700 hover:underline dark:text-purple-400"
											>
												{u.name || u.email}
											</Link>
											{u.role === "admin" && (
												<StatusChip variant="info" icon={Shield}>
													{t("admin", "Ylläpitäjä")}
												</StatusChip>
											)}
										</div>
										{u.name && (
											<p className="break-all text-xs text-stone-600 dark:text-stone-400">
												{u.email}
											</p>
										)}
										<p className="text-xs text-stone-600 sm:hidden dark:text-stone-400">
											{groupsMap.get(u.group_id) ?? t("eiRyhmaa", "Ei ryhmää")}
										</p>
									</td>
									<td className="hidden px-3 py-2 sm:table-cell">
										{groupsMap.get(u.group_id) ?? t("eiRyhmaa", "Ei ryhmää")}
									</td>
									<td className="hidden px-3 py-2 md:table-cell">
										{LANGUAGE_LABELS[u.language] ?? u.language}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			{rows.length > limit && (
				<div className="flex justify-center">
					<Button
						variant="outline"
						onClick={() => setLimit((l) => l + PAGE_SIZE)}
					>
						{t("naytaLisaa", "Näytä lisää")}
					</Button>
				</div>
			)}
		</PageContainer>
	);
}

/** Language select whose empty value means "do not change" */
function LanguageSelectWithPlaceholder({
	value,
	onChange,
	label,
	placeholder,
}: {
	value: string;
	onChange: (v: string) => void;
	label: string;
	placeholder: string;
}) {
	return (
		<Select
			size="sm"
			wrapperClassName="w-auto"
			aria-label={label}
			value={value}
			onChange={(e) => onChange(e.target.value)}
		>
			<option value="">{placeholder}</option>
			{Object.entries(LANGUAGE_LABELS).map(([code, name]) => (
				<option key={code} value={code}>
					{name}
				</option>
			))}
		</Select>
	);
}
