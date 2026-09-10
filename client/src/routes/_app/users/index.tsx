// src/routes/_app/users/index.tsx
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
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useIsAdmin } from "#/hooks/useAuth";
import { useGroups } from "#/hooks/useGroups";
import { type User, useUsers } from "#/hooks/useUsers";
import { requireAuthGuard } from "#/utils/authGuard";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/users/")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: RouteComponent,
});

function UserCard({ user, groupName }: { user: User; groupName?: string }) {
	const { t } = useTranslation();
	return (
		<li className="p-3 border-2 border-stone-800 dark:border-stone-700 flex flex-col justify-between gap-3 rounded-md bg-stone-50 dark:bg-stone-900 shadow-xs hover:border-purple-600 dark:hover:border-purple-500 transition-colors min-w-0">
			<div className="space-y-2 min-w-0">
				{/* Header: Email and ID Chip */}
				<div className="flex items-start justify-between gap-2 min-w-0">
					<h3 className="font-bold text-sm md:text-base text-stone-900 dark:text-stone-100 truncate flex-1">
						{user.email}
					</h3>
					<Chip>{readable_uuid(user.id)}</Chip>
				</div>

				{/* Group Details */}
				<div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
					<Users size={14} className="shrink-0" />
					<span className="truncate">{groupName ?? "Ei ryhmää"}</span>
				</div>
			</div>

			{/* Bottom Controls & Role Badge */}
			<div className="flex items-center justify-between gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 shrink-0">
				{/* Role indicator */}
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
					<Link to="/users/$id" params={{ id: user.id }}>
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
						{t("yhteens", "Yhteensä")} {users?.length || 0}{" "}
						{t("kyttj2", "käyttäjää")}
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
							<Link to="/users/create">
								<Plus size={16} />
								<span>{t("rekisteriKyttj", "Rekisteröi käyttäjä")}</span>
							</Link>
						</Button>
					</div>
				)}
			</div>

			{/* Grid Listing */}
			<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{users?.map((usr) => (
					<UserCard
						key={usr.id}
						user={usr}
						groupName={groupsMap.get(usr.group_id)}
					/>
				))}
			</ul>
		</div>
	);
}

function RouteComponent() {
	return <UserList />;
}
