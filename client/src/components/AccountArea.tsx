import { LogIn, LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Tooltip } from "#/components/Tooltip";
import { useAuth } from "#/hooks/useAuth";

/** Asks the shell to open the sign-in dialog (see `AuthDialog`) */
export function openAuthDialog() {
	window.dispatchEvent(new CustomEvent("kuutar:open-auth-dialog"));
}

interface AccountAreaProps {
	/** Icon-only variant for the collapsed sidebar rail */
	collapsed?: boolean;
}

/** Sign-in / account block at the bottom of the sidebar */
export function AccountArea({ collapsed = false }: AccountAreaProps) {
	const { t } = useTranslation();
	const { user, isAuthenticated, logout } = useAuth();

	const signInLabel = t("kirjauduSisn", "Kirjaudu sisään");
	const signOutLabel = t("kirjauduUlos", "Kirjaudu ulos");

	if (!isAuthenticated) {
		if (collapsed) {
			return (
				<Tooltip content={signInLabel}>
					<Button
						size="icon"
						className="mx-auto"
						aria-label={signInLabel}
						onClick={openAuthDialog}
					>
						<LogIn size={16} aria-hidden="true" />
					</Button>
				</Tooltip>
			);
		}
		return (
			<Button className="w-full" onClick={openAuthDialog}>
				<LogIn size={16} aria-hidden="true" />
				{signInLabel}
			</Button>
		);
	}

	const name = user?.name || user?.email || "";
	const initial = name.charAt(0).toUpperCase();

	if (collapsed) {
		return (
			<div className="flex flex-col items-center gap-1.5">
				<Tooltip content={`${user?.name ?? ""} ${user?.email ?? ""}`.trim()}>
					<div
						role="img"
						aria-label={t("kayttajatili", "Käyttäjätili")}
						className="flex size-9 items-center justify-center rounded-full border border-stone-400 text-sm font-bold dark:border-stone-600"
					>
						{initial}
					</div>
				</Tooltip>
				<Tooltip content={signOutLabel}>
					<Button
						variant="ghost"
						size="icon"
						aria-label={signOutLabel}
						onClick={() => void logout()}
					>
						<LogOut size={16} aria-hidden="true" />
					</Button>
				</Tooltip>
			</div>
		);
	}

	return (
		<div className="space-y-2">
			<div className="min-w-0 px-1">
				<p className="truncate text-sm font-semibold" title={user?.name}>
					{user?.name}
				</p>
				<p
					className="truncate text-xs text-stone-600 dark:text-stone-400"
					title={user?.email}
				>
					{user?.email}
				</p>
			</div>
			<Button
				variant="outline"
				size="sm"
				className="w-full"
				onClick={() => void logout()}
			>
				<LogOut size={14} aria-hidden="true" />
				{signOutLabel}
			</Button>
		</div>
	);
}
