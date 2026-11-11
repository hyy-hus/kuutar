import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Shield, ShieldAlert, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { DetailLayout } from "#/components/DetailLayout";
import { LANGUAGE_LABELS } from "#/components/LanguageSelect";
import { SessionList } from "#/components/SessionList";
import { StatusChip } from "#/components/StatusChip";
import { useGroup } from "#/hooks/useGroups";
import {
	useRevokeAllUserSessions,
	useRevokeUserSession,
	useUserSessions,
} from "#/hooks/useSessions";
import { useDeleteUser, useUser } from "#/hooks/useUsers";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/admin/users/$id")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: ViewUserPage,
});

function ViewUserPage() {
	const { t } = useTranslation();
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
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanKyttj", "Ladataan käyttäjää...")}
			</p>
		);
	if (isError || !user)
		return (
			<p className="text-sm text-red-600 dark:text-red-400">
				{t("kyttjEiLytynyt", "Käyttäjää ei löytynyt.")}
			</p>
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

	const hasSessions = (sessions?.length ?? 0) > 0;

	return (
		<DetailLayout
			back={
				<BackLink to="/admin/users">
					{t("takaisinKyttjiin", "Takaisin käyttäjiin")}
				</BackLink>
			}
			title={user.name || user.email}
			subtitle={user.name ? user.email : undefined}
			status={
				user.role === "admin" ? (
					<StatusChip variant="info" icon={Shield}>
						{t("admin", "Ylläpitäjä")}
					</StatusChip>
				) : undefined
			}
			actions={
				<Button variant="outline" asChild>
					<Link to="/admin/users/edit/$id" params={{ id: user.id }}>
						{t("muokkaa", "Muokkaa")}
					</Link>
				</Button>
			}
			dangerZone={
				<Button
					variant="danger-outline"
					onClick={handleDelete}
					disabled={deleteUser.isPending}
				>
					<Trash2 size={16} />
					<span>{t("poistaKyttj", "Poista käyttäjä")}</span>
				</Button>
			}
			technical={{
				id: user.id,
				createdAt: user.created_at,
				updatedAt: user.updated_at,
			}}
		>
			<section className="space-y-3 rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
				<h2 className="text-lg font-semibold">
					{t("kayttajanTiedot", "Tiedot")}
				</h2>
				<dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
					<dt className="text-stone-600 dark:text-stone-400">
						{t("ryhm", "Ryhmä")}
					</dt>
					<dd>
						{group ? (
							<Link
								to="/admin/groups/$id"
								params={{ id: group.id }}
								className="text-purple-700 hover:underline dark:text-purple-400"
							>
								{group.name}
							</Link>
						) : (
							"—"
						)}
					</dd>
					<dt className="text-stone-600 dark:text-stone-400">
						{t("kieli", "Kieli")}
					</dt>
					<dd>{LANGUAGE_LABELS[user.language] ?? user.language}</dd>
					<dt className="text-stone-600 dark:text-stone-400">
						{t("rooli", "Rooli")}
					</dt>
					<dd>
						{user.role === "admin"
							? t("admin", "Ylläpitäjä")
							: t("kyttj", "Käyttäjä")}
					</dd>
				</dl>
			</section>

			<section className="space-y-3 rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
				<h2 className="text-lg font-semibold">
					{t("aktiivisetIstunnot", "Aktiiviset istunnot")}
				</h2>
				<SessionList
					sessions={sessions ?? []}
					onRevoke={(sessionId) => revokeSession.mutate(sessionId)}
					disabled={revokeSession.isPending}
				/>
				{hasSessions && (
					<Button
						variant="outline"
						size="sm"
						onClick={handleRevokeAllSessions}
						disabled={revokeAllSessions.isPending}
					>
						<ShieldAlert size={16} />
						<span>{t("mittiKaikkiIstunnot", "Mitätöi kaikki istunnot")}</span>
					</Button>
				)}
			</section>
		</DetailLayout>
	);
}
