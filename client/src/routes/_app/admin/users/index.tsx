import { createFileRoute, Link } from "@tanstack/react-router";
import {
	Eye,
	FileSpreadsheet,
	Loader2,
	Plus,
	Shield,
	User as UserIcon,
	Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { LANGUAGE_LABELS } from "#/components/LanguageSelect";
import { useIsAdmin } from "#/hooks/useAuth";
import { useGroups } from "#/hooks/useGroups";
import { type User, useBulkUpdateUsers, useUsers } from "#/hooks/useUsers";
import { SUPPORTED_LANGUAGES } from "#/i18n";
import { requireAdminGuard } from "#/utils/authGuard";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/admin/users/")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: RouteComponent,
});

function UserCard({
	user,
	groupName,
	selectable,
	selected,
	onToggle,
}: {
	user: User;
	groupName?: string;
	selectable: boolean;
	selected: boolean;
	onToggle: () => void;
}) {
	const { t } = useTranslation();
	return (
		<li className="p-3 border-2 border-stone-800 dark:border-stone-700 flex flex-col justify-between gap-3 rounded-md bg-stone-50 dark:bg-stone-900 shadow-xs hover:border-purple-600 dark:hover:border-purple-500 transition-colors min-w-0">
			<div className="space-y-2 min-w-0">
				{/* Header: Name, Email and ID Chip */}
				<div className="flex items-start justify-between gap-2 min-w-0">
					{selectable && (
						<input
							type="checkbox"
							checked={selected}
							onChange={onToggle}
							aria-label={t("valitseKayttaja", "Valitse {{name}}", {
								name: user.name || user.email,
							})}
							className="mt-1 h-4 w-4 shrink-0 accent-purple-600 cursor-pointer"
						/>
					)}
					<div className="flex-1 truncate">
						<h3 className="font-bold text-sm md:text-base text-stone-900 dark:text-stone-100 truncate">
							{user.name || user.email}
						</h3>
						{user.name && (
							<p className="text-xs text-stone-500 dark:text-stone-400 truncate">
								{user.email}
							</p>
						)}
					</div>
					<Chip>{readable_uuid(user.id)}</Chip>
				</div>

				{/* Group Details */}
				<div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
					<Users size={14} className="shrink-0" />
					<span className="truncate">{groupName ?? "Ei ryhmää"}</span>
					<span className="ml-auto font-mono uppercase">{user.language}</span>
				</div>
			</div>

			{/* Bottom Controls & Role Badge */}
			<div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 shrink-0">
				{user.role === "admin" ? (
					<span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
						<Shield size={10} />
						<span>{t("admin", "Admin")}</span>
					</span>
				) : (
					<span className="inline-flex items-center gap-1 text-[10px] font-mono text-stone-600 dark:text-stone-400 bg-stone-200/60 dark:bg-stone-800 px-1.5 py-0.5 rounded">
						<UserIcon size={10} />
						<span>{t("kyttj", "Käyttäjä")}</span>
					</span>
				)}

				<Button
					variant="secondary"
					size="sm"
					asChild
					className="gap-1.5 text-xs"
				>
					<Link to="/admin/users/$id" params={{ id: user.id }}>
						<span>{t("nyt", "Näytä")}</span>
						<Eye size={14} />
					</Link>
				</Button>
			</div>
		</li>
	);
}

function UserList() {
	const { t } = useTranslation();
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

	// Drop selections for users that no longer exist (e.g. after a refetch)
	const selectedUsers = useMemo(
		() => (users ?? []).filter((u) => selectedIds.has(u.id)),
		[users, selectedIds],
	);

	if (loadingUsers || loadingGroups) {
		return (
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanKyttji", "Ladataan käyttäjiä...")}</span>
			</div>
		);
	}

	if (errorUsers) {
		return (
			<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</div>
		);
	}

	const groupsMap = new Map(groups?.map((g) => [g.id, g.name]));
	const allSelected =
		(users?.length ?? 0) > 0 && selectedUsers.length === users?.length;
	const canApply =
		selectedUsers.length > 0 &&
		(targetGroupId !== "" || targetLanguage !== "") &&
		!bulkUpdate.isPending;

	const toggleUser = (id: string) =>
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (!next.delete(id)) next.add(id);
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

	const selectClass =
		"px-3 py-1.5 text-sm bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500";

	return (
		<div className="flex flex-col gap-4 p-2 sm:p-4 flex-1 min-h-0 min-w-0">
			{/* Header & Admin Action */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<div>
					<h1 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
						<UserIcon size={20} className="text-stone-500" />
						<span>{t("kyttjt", "Käyttäjät")}</span>
					</h1>
					<p className="text-xs text-stone-500">
						{t("yhteensaKayttajia", "Yhteensä {{count}} käyttäjää", {
							count: users?.length || 0,
						})}
					</p>
				</div>

				{isAdmin && (
					<div className="flex items-center gap-2 shrink-0">
						<Button variant="secondary" asChild size="sm" className="gap-1.5">
							<Link to="/admin/users/batch-register">
								<FileSpreadsheet size={16} />
								<span>{t("massaRekisterointi", "Massarekisteröinti")}</span>
							</Link>
						</Button>
						<Button asChild size="sm" className="gap-1.5">
							<Link to="/admin/users/create">
								<Plus size={16} />
								<span>{t("rekisteriKyttj", "Rekisteröi käyttäjä")}</span>
							</Link>
						</Button>
					</div>
				)}
			</div>

			{/* Bulk actions */}
			{isAdmin && (users?.length ?? 0) > 0 && (
				<div className="flex flex-col gap-2 p-3 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-100 dark:bg-stone-900/60">
					<div className="flex flex-wrap items-center gap-3">
						<label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
							<input
								type="checkbox"
								checked={allSelected}
								onChange={() =>
									setSelectedIds(
										allSelected
											? new Set()
											: new Set((users ?? []).map((u) => u.id)),
									)
								}
								className="h-4 w-4 accent-purple-600 cursor-pointer"
							/>
							<span>{t("valitseKaikki", "Valitse kaikki")}</span>
						</label>
						<span className="text-xs text-stone-500">
							{t("valittuMaara", "{{count}} valittu", {
								count: selectedUsers.length,
							})}
						</span>
						<select
							aria-label={t("siirraRyhmaan", "Siirrä ryhmään")}
							value={targetGroupId}
							onChange={(e) => setTargetGroupId(e.target.value)}
							className={selectClass}
						>
							<option value="">
								{t("siirraRyhmaanPlaceholder", "-- Siirrä ryhmään --")}
							</option>
							{groups?.map((g) => (
								<option key={g.id} value={g.id}>
									{g.name}
								</option>
							))}
						</select>
						<select
							aria-label={t("asetaKieli", "Aseta kieli")}
							value={targetLanguage}
							onChange={(e) => setTargetLanguage(e.target.value)}
							className={selectClass}
						>
							<option value="">
								{t("asetaKieliPlaceholder", "-- Aseta kieli --")}
							</option>
							{SUPPORTED_LANGUAGES.map((code) => (
								<option key={code} value={code}>
									{LANGUAGE_LABELS[code]}
								</option>
							))}
						</select>
						<Button size="sm" disabled={!canApply} onClick={handleApply}>
							{bulkUpdate.isPending && (
								<Loader2 className="animate-spin" size={14} />
							)}
							<span>{t("toteutaMuutokset", "Toteuta muutokset")}</span>
						</Button>
					</div>
					{bulkErrors.length > 0 && (
						<ul className="text-xs text-rose-600 list-disc pl-5">
							{bulkErrors.map((e) => (
								<li key={e}>{e}</li>
							))}
						</ul>
					)}
				</div>
			)}

			{/* Grid Listing */}
			<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{users?.map((usr) => (
					<UserCard
						key={usr.id}
						user={usr}
						groupName={groupsMap.get(usr.group_id)}
						selectable={isAdmin}
						selected={selectedIds.has(usr.id)}
						onToggle={() => toggleUser(usr.id)}
					/>
				))}
			</ul>
		</div>
	);
}

function RouteComponent() {
	return <UserList />;
}
