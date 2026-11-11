// src/components/SideBar.tsx
import { Link } from "@tanstack/react-router";
import {
	BarChart3,
	Bookmark,
	Box,
	Calendar,
	CalendarCheck,
	CalendarSync,
	FileText,
	Folder,
	Globe,
	Home,
	type LucideIcon,
	Mail,
	Moon,
	Repeat,
	Shield,
	ShieldAlert,
	Sun,
	User,
	UserCog,
	Users,
} from "lucide-react";
import { Popover } from "radix-ui";
import { useTranslation } from "react-i18next";
import { AccountArea } from "#/components/AccountArea";
import LocaleSwitcher from "#/components/LocaleSwitcher";
import { type Theme, ThemeSwitcher } from "#/components/ThemeSwitcher";
import { Tooltip } from "#/components/Tooltip";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { cn } from "#/utils/cn";

interface SideBarProps {
	/** Icon-only rail (desktop); labels move into tooltips */
	collapsed?: boolean;
	theme: Theme;
	onThemeChange: (theme: Theme) => void;
}

export function SideBar({
	collapsed = false,
	theme,
	onThemeChange,
}: SideBarProps) {
	const { t } = useTranslation();
	const { user } = useAuth();
	const { isAdmin } = useIsAdmin();

	type Access = "public" | "auth" | "admin";
	interface NavItem {
		to: string;
		label: string;
		icon: LucideIcon;
		access: Access;
	}
	interface NavGroup {
		key: string;
		label?: string;
		items: NavItem[];
	}

	const navGroups: NavGroup[] = [
		{
			key: "main",
			label: t("varaaminen", "Varaaminen"),
			items: [
				{
					to: "/",
					label: t("etusivu", "Etusivu"),
					icon: Home,
					access: "public",
				},
				{
					to: "/calendar",
					label: t("kalenteri", "Kalenteri"),
					icon: Calendar,
					access: "public",
				},
				{
					to: "/resources",
					label: t("resurssit", "Resurssit"),
					icon: Box,
					access: "auth",
				},
				{
					to: "/reservations",
					label: t("omatVaraukset", "Omat varaukset"),
					icon: Bookmark,
					access: "auth",
				},
				{
					to: "/stats",
					label: t("tilastot", "Tilastot"),
					icon: BarChart3,
					access: "public",
				},
			],
		},
		{
			key: "admin",
			label: t("yllpito", "Ylläpito"),
			items: [
				{
					to: "/admin/dashboard",
					label: t("hyvaksynnat", "Hyväksynnät"),
					icon: Shield,
					access: "admin",
				},
				{
					to: "/admin/rounds",
					label: t("varauskierrokset", "Varauskierrokset"),
					icon: Repeat,
					access: "admin",
				},
				{
					to: "/reservable-blocks",
					label: t("varausjaksot", "Varausjaksot"),
					icon: CalendarCheck,
					access: "admin",
				},
				{
					to: "/restrictions",
					label: t("rajoitukset", "Rajoitukset"),
					icon: ShieldAlert,
					access: "admin",
				},
				{
					to: "/collections",
					label: t("kokoelmat", "Kokoelmat"),
					icon: Folder,
					access: "admin",
				},
				{
					to: "/admin/users",
					label: t("kyttjt", "Käyttäjät"),
					icon: User,
					access: "admin",
				},
				{
					to: "/admin/groups",
					label: t("ryhmt", "Ryhmät"),
					icon: Users,
					access: "admin",
				},
				{
					to: "/contracts",
					label: t("sopimukset", "Sopimukset"),
					icon: FileText,
					access: "admin",
				},
				{
					to: "/admin/email-templates",
					label: t("sahkopostipohjat", "Sähköpostipohjat"),
					icon: Mail,
					access: "admin",
				},
				{
					to: "/admin/outlook",
					label: t("outlookSynkronointi", "Outlook-synkronointi"),
					icon: CalendarSync,
					access: "admin",
				},
			],
		},
	];

	const isVisible = (item: NavItem) => {
		if (item.access === "public") return true;
		if (item.access === "admin") return isAdmin;
		return Boolean(user);
	};

	const visibleGroups = navGroups
		.map((group) => ({ ...group, items: group.items.filter(isVisible) }))
		.filter((group) => group.items.length > 0);

	const meItem: NavItem | null = user
		? {
				to: "/me",
				label: t("omatTiedot", "Omat tiedot"),
				icon: UserCog,
				access: "auth",
			}
		: null;

	const renderLink = (item: NavItem) => {
		const Icon = item.icon;
		const link = (
			<Link
				key={item.to}
				to={item.to}
				aria-label={collapsed ? item.label : undefined}
				activeProps={{
					className:
						"bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900",
				}}
				inactiveProps={{
					className:
						"text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800",
				}}
				className={cn(
					"focus-ring flex items-center rounded-md text-sm font-medium transition-colors",
					collapsed ? "mx-auto size-10 justify-center" : "gap-3 px-3 py-2",
				)}
			>
				<Icon size={collapsed ? 18 : 16} className="shrink-0" />
				{!collapsed && <span className="truncate">{item.label}</span>}
			</Link>
		);
		return collapsed ? (
			<Tooltip key={item.to} content={item.label}>
				{link}
			</Tooltip>
		) : (
			link
		);
	};

	const iconButtonClass =
		"focus-ring mx-auto flex size-10 cursor-pointer items-center justify-center rounded-md text-stone-800 transition-colors hover:bg-stone-200 dark:text-stone-200 dark:hover:bg-stone-800";

	return (
		<div className="flex h-full flex-col justify-between gap-4">
			{/* Navigation Links */}
			<nav aria-label={t("paavalikko", "Päävalikko")}>
				{visibleGroups.map((group, index) => (
					<div
						key={group.key}
						className={cn(
							"space-y-1",
							index > 0 &&
								(collapsed
									? "mt-3 border-t border-stone-300 pt-3 dark:border-stone-700"
									: "mt-4"),
						)}
					>
						{group.label && !collapsed && (
							<div className="px-3 pt-1 pb-0.5 text-xs font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400">
								{group.label}
							</div>
						)}
						{group.items.map(renderLink)}
					</div>
				))}
			</nav>

			<div className="space-y-3">
				<div className="space-y-3 border-t border-stone-300 pt-3 dark:border-stone-700">
					<AccountArea collapsed={collapsed} />
					{meItem && <div>{renderLink(meItem)}</div>}
				</div>

				{/* Language and theme */}
				<div className="shrink-0 space-y-2 border-t border-stone-300 pt-3 dark:border-stone-700">
					{collapsed ? (
						<div className="space-y-1">
							<Popover.Root>
								<Tooltip content={t("kieli", "Kieli")}>
									<Popover.Trigger asChild>
										<button
											type="button"
											aria-label={t("kieli", "Kieli")}
											className={iconButtonClass}
										>
											<Globe size={18} aria-hidden="true" />
										</button>
									</Popover.Trigger>
								</Tooltip>
								<Popover.Portal>
									<Popover.Content
										side="right"
										align="end"
										sideOffset={8}
										className="z-[60] rounded-md border border-stone-300 bg-stone-50 p-2 dark:border-stone-700 dark:bg-stone-900"
									>
										<LocaleSwitcher />
									</Popover.Content>
								</Popover.Portal>
							</Popover.Root>
							<Tooltip
								content={
									theme === "light"
										? t("teemaTumma", "Tumma")
										: t("teemaVaalea", "Vaalea")
								}
							>
								<button
									type="button"
									aria-label={t("toggleTheme", "Vaihda teemaa")}
									onClick={() =>
										onThemeChange(theme === "light" ? "dark" : "light")
									}
									className={iconButtonClass}
								>
									{theme === "light" ? (
										<Sun size={18} aria-hidden="true" />
									) : (
										<Moon size={18} aria-hidden="true" />
									)}
								</button>
							</Tooltip>
						</div>
					) : (
						<>
							<LocaleSwitcher fullWidth />
							<ThemeSwitcher value={theme} onChange={onThemeChange} fullWidth />
						</>
					)}
				</div>
			</div>
		</div>
	);
}
