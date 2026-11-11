import { createFileRoute, Link } from "@tanstack/react-router";
import { Loader2, Plus, Users } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { useIsAdmin } from "#/hooks/useAuth";
import { useGroups } from "#/hooks/useGroups";
import { useUsers } from "#/hooks/useUsers";
import { requireAuthGuard } from "#/utils/authGuard";
import { getLocalizedPlainText } from "#/utils/richText";

export const Route = createFileRoute("/_app/admin/groups/")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: GroupList,
});

function GroupList() {
	const { t, i18n } = useTranslation();
	const { isAdmin } = useIsAdmin();
	const {
		data: groups,
		isLoading: loadingGroups,
		isError: errorGroups,
	} = useGroups();
	// Member counts come from the user list, which only admins may read
	const { data: users } = useUsers({ enabled: isAdmin });

	const memberCounts = useMemo(() => {
		const counts = new Map<string, number>();
		for (const u of users ?? [])
			counts.set(u.group_id, (counts.get(u.group_id) ?? 0) + 1);
		return counts;
	}, [users]);

	if (loadingGroups) {
		return (
			<div className="flex items-center gap-2 py-8 text-stone-600 dark:text-stone-400">
				<Loader2 className="animate-spin" size={18} />
				<span>{t("ladataanRyhmi", "Ladataan ryhmiä...")}</span>
			</div>
		);
	}

	if (errorGroups) {
		return (
			<Callout variant="danger">
				{t("virheLadattaessaTietoja", "Virhe ladattaessa tietoja.")}
			</Callout>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title={t("ryhmt", "Ryhmät")}
				subtitle={t("yhteensaRyhmia", "Yhteensä {{count}} ryhmää", {
					count: groups?.length ?? 0,
				})}
				actions={
					isAdmin && (
						<Button asChild>
							<Link to="/admin/groups/create">
								<Plus size={16} />
								<span>{t("lisRyhm", "Lisää ryhmä")}</span>
							</Link>
						</Button>
					)
				}
			/>

			{groups?.length ? (
				<ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{groups.map((grp) => (
						<li key={grp.id} className="flex min-w-0 flex-col *:flex-1">
							<EntityCard
								to="/admin/groups/$id"
								params={{ id: grp.id }}
								icon={Users}
								title={grp.name}
								meta={
									isAdmin && users
										? t("jasenMaara", "{{count}} jäsentä", {
												count: memberCounts.get(grp.id) ?? 0,
											})
										: undefined
								}
								description={
									getLocalizedPlainText(grp.description, i18n.language) ||
									undefined
								}
							/>
						</li>
					))}
				</ul>
			) : (
				<EmptyState icon={Users} title={t("eiRyhmia", "Ei ryhmiä")} />
			)}
		</PageContainer>
	);
}
