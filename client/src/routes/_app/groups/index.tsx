// src/routes/_app/groups/index.tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Eye, Loader2, Plus, Users } from "lucide-react";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useGroups, type Group } from "#/hooks/useGroups";
import { useIsAdmin } from "#/hooks/useAuth";
import { readable_uuid } from "#/utils/uuid";
import { requireAuthGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/groups/")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: RouteComponent,
});

function GroupCard({ group }: { group: Group }) {
	return (
		<li className="p-3 border-2 border-stone-800 dark:border-stone-700 flex flex-col justify-between gap-3 rounded-md bg-stone-50 dark:bg-stone-900 shadow-xs hover:border-purple-600 dark:hover:border-purple-500 transition-colors min-w-0">
			<div className="space-y-2 min-w-0">
				{/* Header: Name and ID Chip */}
				<div className="flex items-start justify-between gap-2 min-w-0">
					<h3 className="font-bold text-sm md:text-base text-stone-900 dark:text-stone-100 truncate flex-1">
						{group.name}
					</h3>
					<Chip>{readable_uuid(group.id)}</Chip>
				</div>

				{/* Description */}
				<p className="text-xs text-stone-600 dark:text-stone-400 line-clamp-2 min-h-8">
					{group.description || "Ei kuvausta saatavilla."}
				</p>
			</div>

			{/* Bottom Action Row */}
			<div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-200 dark:border-stone-800 shrink-0">
				<Button
					variant="secondary"
					size="sm"
					asChild
					className="gap-1.5 text-xs"
				>
					<Link to="/groups/$id" params={{ id: group.id }}>
						<span>Näytä</span>
						<Eye size={14} />
					</Link>
				</Button>
			</div>
		</li>
	);
}

function GroupList() {
	const { isAdmin } = useIsAdmin();
	const {
		data: groups,
		isLoading: loadingGroups,
		isError: errorGroups,
	} = useGroups();

	if (loadingGroups) {
		return (
			<div className="p-8 flex items-center justify-center gap-2 text-stone-500">
				<Loader2 className="animate-spin" size={18} />
				<span>Ladataan ryhmiä...</span>
			</div>
		);
	}

	if (errorGroups) {
		return (
			<div className="p-4 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
				Virhe ladattaessa tietoja.
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-4 p-2 sm:p-4 flex-1 min-h-0 min-w-0">
			{/* Header & Admin Action */}
			<div className="flex items-center justify-between gap-2 shrink-0 border-b border-stone-200 dark:border-stone-800 pb-3">
				<div>
					<h1 className="text-lg sm:text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 flex items-center gap-2">
						<Users size={20} className="text-stone-500" />
						<span>Ryhmät</span>
					</h1>
					<p className="text-xs text-stone-500">
						Yhteensä {groups?.length || 0} ryhmää
					</p>
				</div>

				{isAdmin && (
					<Button asChild size="sm" className="gap-1.5 shrink-0">
						<Link to="/groups/create">
							<Plus size={16} />
							<span>Lisää ryhmä</span>
						</Link>
					</Button>
				)}
			</div>

			{/* Grid Listing */}
			<ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
				{groups?.map((grp) => (
					<GroupCard key={grp.id} group={grp} />
				))}
			</ul>
		</div>
	);
}

function RouteComponent() {
	return <GroupList />;
}
