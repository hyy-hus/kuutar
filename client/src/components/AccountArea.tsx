import { Link } from "@tanstack/react-router";
import { LogIn, LogOut, Settings, UserCog } from "lucide-react";
import { Popover } from "radix-ui";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import LocaleSwitcher from "#/components/LocaleSwitcher";
import { type Theme, ThemeSwitcher } from "#/components/ThemeSwitcher";
import { Tooltip } from "#/components/Tooltip";
import { useAuth } from "#/hooks/useAuth";
import { cn } from "#/utils/cn";

/** Asks the shell to open the sign-in dialog (see `AuthDialog`) */
export function openAuthDialog() {
	window.dispatchEvent(new CustomEvent("kuutar:open-auth-dialog"));
}

const rowClass =
	"focus-ring flex cursor-pointer items-center rounded-md text-sm font-medium text-stone-800 transition-colors hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-800";

interface AccountMenuProps {
	/** Null for a guest */
	user: { name?: string | null; email?: string | null } | null;
	/** Icon-only variant for the collapsed sidebar rail */
	collapsed?: boolean;
	theme: Theme;
	onThemeChange: (theme: Theme) => void;
	onLogout: () => void;
	onSignIn: () => void;
}

function MenuContent({
	children,
	collapsed,
}: {
	children: ReactNode;
	collapsed: boolean;
}) {
	return (
		<Popover.Portal>
			<Popover.Content
				side={collapsed ? "right" : "top"}
				align={collapsed ? "end" : "start"}
				sideOffset={8}
				collisionPadding={8}
				className="z-[60] w-64 rounded-md border border-stone-300 bg-stone-50 p-2 text-stone-900 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
			>
				{children}
			</Popover.Content>
		</Popover.Portal>
	);
}

function MenuLabel({ children }: { children: ReactNode }) {
	return (
		<p className="px-2 pb-1 text-xs font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400">
			{children}
		</p>
	);
}

function Preferences({
	theme,
	onThemeChange,
}: Pick<AccountMenuProps, "theme" | "onThemeChange">) {
	const { t } = useTranslation();
	return (
		<div className="space-y-3 px-1 py-2">
			<div>
				<MenuLabel>{t("kieli", "Kieli")}</MenuLabel>
				<LocaleSwitcher fullWidth />
			</div>
			<div>
				<MenuLabel>{t("teema", "Teema")}</MenuLabel>
				<ThemeSwitcher value={theme} onChange={onThemeChange} fullWidth />
			</div>
		</div>
	);
}

/**
 * The one account control at the bottom of the sidebar: a compact row (avatar, name,
 * email) that opens a menu with profile, language, theme and sign-out. Guests get a quiet
 * sign-in row plus a settings button for language and theme.
 */
export function AccountMenu({
	user,
	collapsed = false,
	theme,
	onThemeChange,
	onLogout,
	onSignIn,
}: AccountMenuProps) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);

	if (!user) {
		const signInLabel = t("kirjauduSisn", "Kirjaudu sisään");
		const settingsLabel = t("asetukset", "Asetukset");
		const settings = (
			<Popover.Root>
				<Tooltip content={settingsLabel}>
					<Popover.Trigger asChild>
						<button
							type="button"
							aria-label={settingsLabel}
							className={cn(rowClass, "size-10 shrink-0 justify-center")}
						>
							<Settings size={18} aria-hidden="true" />
						</button>
					</Popover.Trigger>
				</Tooltip>
				<MenuContent collapsed={collapsed}>
					<Preferences theme={theme} onThemeChange={onThemeChange} />
				</MenuContent>
			</Popover.Root>
		);
		if (collapsed) {
			return (
				<div className="flex flex-col items-center gap-1">
					<Tooltip content={signInLabel}>
						<button
							type="button"
							aria-label={signInLabel}
							onClick={onSignIn}
							className={cn(rowClass, "size-10 justify-center")}
						>
							<LogIn size={18} aria-hidden="true" />
						</button>
					</Tooltip>
					{settings}
				</div>
			);
		}
		return (
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={onSignIn}
					className={cn(rowClass, "h-10 min-w-0 flex-1 gap-3 px-3")}
				>
					<LogIn size={16} className="shrink-0" aria-hidden="true" />
					<span className="truncate">{signInLabel}</span>
				</button>
				{settings}
			</div>
		);
	}

	const name = user.name || user.email || "";
	const accountLabel = t("kayttajatili", "Käyttäjätili");
	const avatar = (
		<span
			aria-hidden="true"
			className="flex size-8 shrink-0 items-center justify-center rounded-full border border-stone-400 bg-stone-50 text-sm font-bold dark:border-stone-600 dark:bg-stone-900"
		>
			{name.charAt(0).toUpperCase()}
		</span>
	);

	const trigger = collapsed ? (
		<Tooltip content={name}>
			<Popover.Trigger asChild>
				<button
					type="button"
					aria-label={`${accountLabel}: ${name}`}
					className={cn(rowClass, "mx-auto size-10 justify-center")}
				>
					{avatar}
				</button>
			</Popover.Trigger>
		</Tooltip>
	) : (
		<Popover.Trigger asChild>
			<button
				type="button"
				aria-label={`${accountLabel}: ${name}`}
				className={cn(rowClass, "h-12 w-full gap-3 px-2 text-left")}
			>
				{avatar}
				<span className="min-w-0 flex-1">
					<span className="block truncate text-sm font-semibold">
						{user.name || user.email}
					</span>
					{user.name && user.email && (
						<span className="block truncate text-xs font-normal text-stone-600 dark:text-stone-400">
							{user.email}
						</span>
					)}
				</span>
			</button>
		</Popover.Trigger>
	);

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			{trigger}
			<MenuContent collapsed={collapsed}>
				<Link
					to="/me"
					onClick={() => setOpen(false)}
					className={cn(rowClass, "h-10 gap-3 px-2")}
				>
					<UserCog size={16} aria-hidden="true" />
					{t("omatTiedot", "Omat tiedot")}
				</Link>
				<div className="my-1 border-t border-stone-300 dark:border-stone-700" />
				<Preferences theme={theme} onThemeChange={onThemeChange} />
				<div className="my-1 border-t border-stone-300 dark:border-stone-700" />
				<button
					type="button"
					onClick={() => {
						setOpen(false);
						onLogout();
					}}
					className={cn(
						rowClass,
						"h-10 w-full gap-3 px-2 font-normal text-stone-600 dark:text-stone-400",
					)}
				>
					<LogOut size={16} aria-hidden="true" />
					{t("kirjauduUlos", "Kirjaudu ulos")}
				</button>
			</MenuContent>
		</Popover.Root>
	);
}

interface AccountAreaProps {
	collapsed?: boolean;
	theme: Theme;
	onThemeChange: (theme: Theme) => void;
}

/** `AccountMenu` wired to the auth state */
export function AccountArea({
	collapsed,
	theme,
	onThemeChange,
}: AccountAreaProps) {
	const { user, isAuthenticated, logout } = useAuth();
	return (
		<AccountMenu
			user={isAuthenticated ? (user ?? { name: "", email: "" }) : null}
			collapsed={collapsed}
			theme={theme}
			onThemeChange={onThemeChange}
			onLogout={() => void logout()}
			onSignIn={openAuthDialog}
		/>
	);
}
