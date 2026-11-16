import { Undo2, VenetianMask } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { useImpersonation, useMe } from "#/hooks/useAuth";

interface ImpersonationBannerProps {
	/** The user the admin is acting as */
	user: { name?: string | null; email: string };
	onStop: () => void;
	stopping?: boolean;
}

/**
 * Full-width strip above the header while an admin acts as another user: says whose
 * session this is and offers the way back. It is the one place outside `Callout` and
 * `StatusChip` that uses the warning tokens, so it stands out from page content.
 */
export function ImpersonationBanner({
	user,
	onStop,
	stopping,
}: ImpersonationBannerProps) {
	const { t } = useTranslation();
	const name = user.name ? `${user.name} (${user.email})` : user.email;
	return (
		<div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b-2 border-status-warning-line bg-status-warning-bg px-3 py-2 text-sm text-status-warning-ink">
			<VenetianMask size={18} aria-hidden="true" className="shrink-0" />
			<p className="min-w-0 flex-1">
				<span className="font-semibold">
					{t("toimitKayttajana", "Toimit käyttäjänä {{name}}.", { name })}
				</span>{" "}
				{t(
					"toimitKayttajanaSelite",
					"Kaikki toimet tehdään oikeasti tämän käyttäjän nimissä.",
				)}
			</p>
			<Button
				variant="outline"
				size="sm"
				onClick={onStop}
				disabled={stopping}
				className="shrink-0 gap-1"
			>
				<Undo2 size={14} aria-hidden="true" />
				<span>{t("palaaOmaanIstuntoon", "Palaa omaan istuntoon")}</span>
			</Button>
		</div>
	);
}

/** `ImpersonationBanner` wired to the auth state; renders nothing in a normal session */
export function ImpersonationArea() {
	const { data: me } = useMe();
	const { stop, returnToAdmin } = useImpersonation();
	const [stopping, setStopping] = useState(false);

	// The session ran out (one-hour cap); the API client already restored the admin's tokens
	useEffect(() => {
		const onEnded = (e: Event) => {
			const userId = (e as CustomEvent<{ userId?: string }>).detail?.userId;
			returnToAdmin(userId ?? null);
		};
		window.addEventListener("kuutar:impersonation-ended", onEnded);
		return () =>
			window.removeEventListener("kuutar:impersonation-ended", onEnded);
	}, [returnToAdmin]);

	if (!me?.impersonator) return null;

	return (
		<ImpersonationBanner
			user={me}
			stopping={stopping}
			onStop={async () => {
				setStopping(true);
				try {
					await stop();
				} finally {
					setStopping(false);
				}
			}}
		/>
	);
}
