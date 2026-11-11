import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { DetailLayout } from "#/components/DetailLayout";
import { RichTextContent } from "#/components/RichTextContent";
import { useIsAdmin } from "#/hooks/useAuth";
import { useDeleteGroup, useGroup } from "#/hooks/useGroups";
import { useUsers } from "#/hooks/useUsers";
import { requireAuthGuard } from "#/utils/authGuard";
import { getLocalizedPlainText } from "#/utils/richText";

export const Route = createFileRoute("/_app/admin/groups/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: ViewGroupPage,
});

function ViewGroupPage() {
	const { t, i18n } = useTranslation();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { isAdmin } = useIsAdmin();
	const { data: group, isLoading, isError } = useGroup(id);
	const { data: users } = useUsers({ enabled: isAdmin });
	const deleteGroup = useDeleteGroup();

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanRyhm", "Ladataan ryhmää...")}
			</p>
		);
	if (isError || !group)
		return (
			<p className="text-sm text-red-600 dark:text-red-400">
				{t("ryhmEiLytynyt", "Ryhmää ei löytynyt.")}
			</p>
		);

	const members = (users ?? [])
		.filter((u) => u.group_id === group.id)
		.sort((a, b) => a.name.localeCompare(b.name, i18n.language));
	const hasDescription =
		getLocalizedPlainText(group.description, i18n.language) !== "";

	const handleDelete = async () => {
		if (
			confirm(
				t("vahvistaRyhmanPoisto", "Haluatko varmasti poistaa tämän ryhmän?"),
			)
		) {
			await deleteGroup.mutateAsync(id);
			navigate({ to: "/admin/groups" });
		}
	};

	return (
		<DetailLayout
			back={
				<BackLink to="/admin/groups">
					{t("takaisinRyhmiin", "Takaisin ryhmiin")}
				</BackLink>
			}
			title={group.name}
			subtitle={
				isAdmin && users
					? t("jasenMaara", "{{count}} jäsentä", { count: members.length })
					: undefined
			}
			actions={
				isAdmin && (
					<Button variant="outline" asChild>
						<Link to="/admin/groups/edit/$id" params={{ id: group.id }}>
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
						disabled={deleteGroup.isPending}
					>
						<Trash2 size={16} />
						<span>{t("poistaRyhm", "Poista ryhmä")}</span>
					</Button>
				)
			}
			technical={{
				id: group.id,
				createdAt: group.created_at,
				updatedAt: group.updated_at,
			}}
		>
			{hasDescription && (
				<RichTextContent
					value={group.description}
					className="rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900"
				/>
			)}

			{isAdmin && users && (
				<section className="space-y-3">
					<h2 className="text-lg font-semibold">
						{t("ryhmanJasenet", "Jäsenet")}
					</h2>
					{members.length === 0 ? (
						<p className="text-sm text-stone-600 dark:text-stone-400">
							{t("ryhmassaEiKayttajia", "Ryhmässä ei ole käyttäjiä.")}
						</p>
					) : (
						<ul className="divide-y divide-stone-200 rounded-md border border-stone-300 bg-stone-50 dark:divide-stone-800 dark:border-stone-700 dark:bg-stone-900">
							{members.map((u) => (
								<li key={u.id}>
									<Link
										to="/admin/users/$id"
										params={{ id: u.id }}
										className="focus-ring flex flex-wrap items-baseline gap-x-3 px-4 py-2 text-sm hover:bg-stone-100 dark:hover:bg-stone-800"
									>
										<span className="font-medium">{u.name || u.email}</span>
										{u.name && (
											<span className="text-xs text-stone-600 dark:text-stone-400">
												{u.email}
											</span>
										)}
									</Link>
								</li>
							))}
						</ul>
					)}
				</section>
			)}
		</DetailLayout>
	);
}
