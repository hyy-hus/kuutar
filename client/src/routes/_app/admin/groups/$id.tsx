import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { RichTextContent } from "#/components/RichTextContent";
import { useDeleteGroup, useGroup } from "#/hooks/useGroups";
import { requireAuthGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/admin/groups/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: ViewGroupPage,
});

function ViewGroupPage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: group, isLoading, isError } = useGroup(id);
	const deleteGroup = useDeleteGroup();

	if (isLoading)
		return (
			<div className="p-4 text-sm text-stone-500">
				{t("ladataanRyhm", "Ladataan ryhmää...")}
			</div>
		);
	if (isError || !group)
		return (
			<div className="p-4 text-sm text-red-500">
				{t("ryhmEiLytynyt", "Ryhmää ei löytynyt.")}
			</div>
		);

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
		<div className="p-4 max-w-xl flex flex-col gap-6">
			<BackLink to="/admin/groups">
				{t("takaisinRyhmiin", "Takaisin ryhmiin")}
			</BackLink>

			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
					{group.name}
				</h1>
				<Chip>{readable_uuid(group.id)}</Chip>
			</div>

			{/* 2. Localized rich-text description */}
			<RichTextContent
				value={group.description}
				className="p-3 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900"
			/>

			<div className="space-y-2">
				<div className="text-md">
					<p>
						<strong>{t("muokattu", "Muokattu:")}</strong>{" "}
						{formatDate(group.updated_at)}
					</p>
					<p>
						<strong>{t("luotu", "Luotu:")}</strong>{" "}
						{formatDate(group.created_at)}
					</p>
				</div>
			</div>

			<div className="flex flex-col gap-2 pt-2">
				<Button
					variant="secondary"
					className="w-full flex items-center justify-center gap-2"
					asChild
				>
					<Link to="/admin/groups/edit/$id" params={{ id: group.id }}>
						<span>{t("muokkaa", "Muokkaa")}</span>
						<Edit size={16} />
					</Link>
				</Button>

				<Button
					variant="danger"
					className="w-full flex items-center justify-center gap-2"
					onClick={handleDelete}
					disabled={deleteGroup.isPending}
				>
					<span>{t("poistaRyhm", "Poista ryhmä")}</span>
					<Trash2 size={16} />
				</Button>
			</div>
		</div>
	);
}
