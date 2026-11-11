import { LogOut, Monitor } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import type { Session } from "#/hooks/useSessions";
import { useDateFormatter } from "#/utils/date";
import { describeUserAgent } from "#/utils/userAgent";

/** Active sessions with an "end" button on each one except the current session */
export function SessionList({
	sessions,
	onRevoke,
	disabled,
}: {
	sessions: Session[];
	onRevoke: (sessionId: string) => void;
	disabled?: boolean;
}) {
	const { t } = useTranslation();
	const { formatDateTime } = useDateFormatter();

	if (sessions.length === 0) {
		return (
			<p className="text-xs text-stone-600 dark:text-stone-400">
				{t("eiAktiivisiaIstuntoja", "Ei aktiivisia istuntoja.")}
			</p>
		);
	}

	return (
		<ul className="space-y-2">
			{sessions.map((session) => (
				<li
					key={session.session_id}
					className="flex items-center gap-3 p-2 rounded-md border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900"
				>
					<Monitor
						size={16}
						aria-hidden="true"
						className="shrink-0 text-stone-600 dark:text-stone-400"
					/>
					<div className="min-w-0 flex-1 text-xs">
						<p className="font-semibold text-stone-900 dark:text-stone-100 truncate">
							{describeUserAgent(session.user_agent) ??
								t("tuntematonLaite", "Tuntematon laite")}
							{session.current && (
								<span className="ml-2 font-normal text-purple-700 dark:text-purple-400">
									{t("tamaLaite", "Tämä laite")}
								</span>
							)}
						</p>
						<p className="tabular-nums text-stone-600 dark:text-stone-400">
							{`${t("viimeksiAktiivinen", "Viimeksi aktiivinen")}: ${formatDateTime(session.last_active_at)}`}
							{session.ip ? ` · ${session.ip}` : ""}
						</p>
						<p className="tabular-nums text-stone-600 dark:text-stone-400">
							{`${t("istuntoAlkoi", "Alkoi")}: ${formatDateTime(session.started_at)}`}
						</p>
					</div>
					{!session.current && (
						<Button
							variant="outline"
							size="sm"
							disabled={disabled}
							onClick={() => onRevoke(session.session_id)}
							aria-label={t("paataIstunto", "Päätä istunto")}
							className="shrink-0 gap-1"
						>
							<LogOut size={14} />
							<span>{t("paata", "Päätä")}</span>
						</Button>
					)}
				</li>
			))}
		</ul>
	);
}
