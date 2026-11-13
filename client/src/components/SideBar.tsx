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
	Home,
	type LucideIcon,
	Mail,
	Newspaper,
	Repeat,
	Shield,
	ShieldAlert,
	User,
	Users,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { AccountArea } from "#/components/AccountArea";
import type { Theme } from "#/components/ThemeSwitcher";
import { Tooltip } from "#/components/Tooltip";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { useUnreadNewsCount } from "#/hooks/useNews";
import { cn } from "#/utils/cn";
import { formatUnreadCount } from "#/utils/news";

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
	const { data: unreadNews = 0 } = useUnreadNewsCount({
		enabled: Boolean(user),
	});

	type Access = "public" | "auth" | "admin";
	interface NavItem {
		to: string;
		label: string;
		icon: LucideIcon;
		access: Access;
		/** Unread count; shown as a pill, or a dot when collapsed */
		badge?: number;
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
					to: "/news",
					label: t("tiedotteet", "Tiedotteet"),
					icon: Newspaper,
					access: "public",
					badge: user ? unreadNews : undefined,
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

	const renderLink = (item: NavItem) => {
		const Icon = item.icon;
		const badge = item.badge ? formatUnreadCount(item.badge) : null;
		const unreadText = badge
			? t("lukemattomiaCount", "{{count}} lukematonta", { count: item.badge })
			: null;
		const fullLabel = unreadText ? `${item.label}, ${unreadText}` : item.label;
		const link = (
			<Link
				key={item.to}
				to={item.to}
				aria-label={collapsed || unreadText ? fullLabel : undefined}
				activeProps={{
					className:
						"bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900",
				}}
				inactiveProps={{
					className:
						"text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800",
				}}
				className={cn(
					"focus-ring relative flex items-center rounded-md text-sm font-medium transition-colors",
					collapsed ? "mx-auto size-10 justify-center" : "gap-3 px-3 py-2",
				)}
			>
				<Icon size={collapsed ? 18 : 16} className="shrink-0" />
				{!collapsed && <span className="truncate">{item.label}</span>}
				{badge &&
					(collapsed ? (
						<span
							aria-hidden="true"
							className="absolute top-1.5 right-1.5 size-2 rounded-full bg-accent ring-2 ring-stone-100 dark:ring-stone-900"
						/>
					) : (
						<span
							aria-hidden="true"
							className="ml-auto min-w-5 rounded-full bg-accent px-1.5 text-center text-xs leading-5 font-semibold tabular-nums text-surface"
						>
							{badge}
						</span>
					))}
			</Link>
		);
		return collapsed ? (
			<Tooltip key={item.to} content={fullLabel}>
				{link}
			</Tooltip>
		) : (
			link
		);
	};

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Only the nav list scrolls; the account area stays pinned */}
			<nav
				aria-label={t("paavalikko", "Päävalikko")}
				className="thin-scrollbar min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2"
			>
				{visibleGroups.map((group, index) => (
					<div
						key={group.key}
						className={cn(
							"space-y-1",
							index > 0 &&
								(collapsed
									? "mt-2 border-t border-stone-300 pt-2 dark:border-stone-700"
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

			<div className="shrink-0 border-t border-stone-300 p-2 dark:border-stone-700">
				<AccountArea
					collapsed={collapsed}
					theme={theme}
					onThemeChange={onThemeChange}
				/>
			</div>
		</div>
	);
}
