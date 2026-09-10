import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { useDeleteGroup, useGroup } from "#/hooks/useGroups";
import { requireAuthGuard } from "#/utils/authGuard";
import { formatDate } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/groups/$id")({
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: ViewGroupPage,
});

function ViewGroupPage() {
	const { t } = useTranslation();
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
		if (confirm("Haluatko varmasti poistaa tämän ryhmän?")) {
			await deleteGroup.mutateAsync(id);
			navigate({ to: "/groups" });
		}
	};

	return (
		<div className="p-4 max-w-xl flex flex-col gap-6">
			<Link
				to="/groups"
				className="inline-flex items-center gap-1 text-xs text-stone-500 hover:underline"
			>
				<ArrowLeft size={14} /> {t("takaisinRyhmiin", "Takaisin ryhmiin")}
			</Link>

			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
					{group.name}
				</h1>
				<Chip>{readable_uuid(group.id)}</Chip>
			</div>

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
					<Link to="/groups/edit/$id" params={{ id: group.id }}>
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
