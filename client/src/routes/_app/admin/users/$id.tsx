import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Edit, KeyRound, ShieldAlert, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Chip } from "#/components/Chip";
import { SessionList } from "#/components/SessionList";
import { useGroup } from "#/hooks/useGroups";
import {
	useRevokeAllUserSessions,
	useRevokeUserSession,
	useUserSessions,
} from "#/hooks/useSessions";
import { useDeleteUser, useUser } from "#/hooks/useUsers";
import { requireAdminGuard } from "#/utils/authGuard";
import { useDateFormatter } from "#/utils/date";
import { readable_uuid } from "#/utils/uuid";

export const Route = createFileRoute("/_app/admin/users/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: ViewUserPage,
});

function ViewUserPage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { data: user, isLoading, isError } = useUser(id);
	const { data: group } = useGroup(user?.group_id ?? "");
	const deleteUser = useDeleteUser();
	const { data: sessions } = useUserSessions(id);
	const revokeSession = useRevokeUserSession(id);
	const revokeAllSessions = useRevokeAllUserSessions(id);

	if (isLoading)
		return (
			<div className="p-4 text-sm text-stone-500">
				{t("ladataanKyttj", "Ladataan käyttäjää...")}
			</div>
		);
	if (isError || !user)
		return (
			<div className="p-4 text-sm text-red-500">
				{t("kyttjEiLytynyt", "Käyttäjää ei löytynyt.")}
			</div>
		);

	const handleDelete = async () => {
		if (
			confirm(
				t(
					"vahvistaKayttajanPoisto",
					"Haluatko varmasti poistaa tämän käyttäjän?",
				),
			)
		) {
			await deleteUser.mutateAsync(id);
			navigate({ to: "/admin/users" });
		}
	};

	const handleRevokeAllSessions = async () => {
		if (
			confirm(
				t(
					"haluatkoVarmastiPttKaikkiTmnKyttjnAktiivisetIstunnot",
					"Haluatko varmasti päättää kaikki tämän käyttäjän aktiiviset istunnot?",
				),
			)
		) {
			await revokeAllSessions.mutateAsync();
		}
	};

	return (
		<div className="p-4 max-w-xl flex flex-col gap-6">
			<BackLink to="/admin/users">
				{t("takaisinKyttjiin", "Takaisin käyttäjiin")}
			</BackLink>

			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100">
						{user.name}
					</h1>
					<p className="text-sm text-stone-500 dark:text-stone-400">
						{user.email}
					</p>
					<span className="text-xs font-semibold uppercase tracking-wider text-purple-600 dark:text-purple-400">
						{user.role}
					</span>
				</div>
				<Chip>{readable_uuid(user.id)}</Chip>
			</div>

			{/* Details */}
			<div className="space-y-2">
				<div className="text-md">
					<p>
						<strong>{t("ryhm2", "Ryhmä:")}</strong> {group?.name ?? "—"}
					</p>
					<hr className="my-2 border-stone-300 dark:border-stone-800" />
					<p>
						<strong>{t("muokattu", "Muokattu:")}</strong>{" "}
						{formatDate(user.updated_at)}
					</p>
					<p>
						<strong>{t("luotu", "Luotu:")}</strong>{" "}
						{formatDate(user.created_at)}
					</p>
				</div>
			</div>

			{/* Active Sessions Box */}
			<div className="p-4 border border-stone-200 dark:border-stone-800 rounded-md bg-stone-50 dark:bg-stone-900/50 space-y-3">
				<div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-semibold text-sm">
					<KeyRound size={16} />
					<span>{t("aktiivisetIstunnot", "Aktiiviset istunnot")}</span>
				</div>
				<SessionList
					sessions={sessions ?? []}
					onRevoke={(sessionId) => revokeSession.mutate(sessionId)}
					disabled={revokeSession.isPending}
				/>
				<Button
					variant="outline"
					size="sm"
					onClick={handleRevokeAllSessions}
					disabled={revokeAllSessions.isPending || !sessions?.length}
					className="w-full flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900"
				>
					<ShieldAlert size={16} />
					<span>{t("mittiKaikkiIstunnot", "Mitätöi kaikki istunnot")}</span>
				</Button>
			</div>

			{/* Actions */}
			<div className="flex flex-col gap-2 pt-2">
				<Button
					variant="secondary"
					className="w-full flex items-center justify-center gap-2"
					asChild
				>
					<Link to="/admin/users/edit/$id" params={{ id: user.id }}>
						<span>{t("muokkaa", "Muokkaa")}</span>
						<Edit size={16} />
					</Link>
				</Button>

				<Button
					variant="danger"
					className="w-full flex items-center justify-center gap-2"
					onClick={handleDelete}
					disabled={deleteUser.isPending}
				>
					<span>{t("poistaKyttj", "Poista käyttäjä")}</span>
					<Trash2 size={16} />
				</Button>
			</div>
		</div>
	);
}
