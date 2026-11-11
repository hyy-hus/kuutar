// src/components/SideBar.tsx
import { Link } from "@tanstack/react-router";
import {
	BarChart3,
	Bookmark,
	Box,
	Calendar,
	CalendarCheck,
	CalendarSync,
	ChevronDown,
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
import { useTranslation } from "react-i18next";
import { LANGUAGE_LABELS } from "#/components/LanguageSelect";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { SUPPORTED_LANGUAGES, selectLanguage } from "#/i18n";

interface SideBarProps {
	isSidebarOpen: boolean;
	theme: "light" | "dark";
	toggleTheme: () => void;
}

export function SideBar({ theme, toggleTheme }: SideBarProps) {
	const { t, i18n } = useTranslation();
	const { user } = useAuth();
	const { isAdmin } = useIsAdmin();

	const currentLocale = i18n.language || "fi";

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
		return (
			<Link
				key={item.to}
				to={item.to}
				activeProps={{
					className:
						"bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900",
				}}
				inactiveProps={{
					className:
						"text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800",
				}}
				className="flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-purple-500 focus-visible:outline-offset-2"
			>
				<Icon size={16} className="shrink-0" />
				<span className="truncate">{item.label}</span>
			</Link>
		);
	};

	return (
		<div className="flex flex-col justify-between h-full gap-4">
			{/* Navigation Links */}
			<nav className="space-y-4">
				{visibleGroups.map((group) => (
					<div key={group.key} className="space-y-1">
						{group.label && (
							<div className="px-3 pt-1 pb-0.5 text-xs font-mono uppercase tracking-wider text-stone-600 dark:text-stone-400">
								{group.label}
							</div>
						)}
						{group.items.map(renderLink)}
					</div>
				))}
			</nav>

			<div className="space-y-3">
				{meItem && <div>{renderLink(meItem)}</div>}

				{/* Bottom Controls Bar */}
				<div className="pt-3 border-t border-stone-300 dark:border-stone-800 flex gap-1.5 items-center shrink-0">
					{/* Language Select Dropdown */}
					<div className="relative flex-1">
						<div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-stone-500 dark:text-stone-400">
							<Globe size={14} />
						</div>
						<select
							value={currentLocale}
							onChange={(e) => selectLanguage(e.target.value)}
							className="w-full h-8 pl-8 pr-7 text-sm font-medium rounded-md border border-stone-300 dark:border-stone-700 bg-stone-200/60 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 appearance-none cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-600"
						>
							{SUPPORTED_LANGUAGES.map((code) => (
								<option
									key={code}
									value={code}
									className="bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100"
								>
									{LANGUAGE_LABELS[code] || code.toUpperCase()}
								</option>
							))}
						</select>
						<div className="absolute inset-y-0 right-0 pr-2 flex items-center pointer-events-none text-stone-400">
							<ChevronDown size={13} />
						</div>
					</div>

					{/* Theme Switcher Button */}
					<button
						type="button"
						onClick={toggleTheme}
						aria-label={t("toggleTheme", "Vaihda teemaa")}
						className="h-8 w-8 shrink-0 rounded-md border border-stone-300 dark:border-stone-700 bg-stone-200/60 dark:bg-stone-800/60 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-stone-100 flex items-center justify-center transition-colors focus:outline-none focus:ring-1 focus:ring-purple-600"
					>
						{theme === "light" ? <Sun size={14} /> : <Moon size={14} />}
					</button>
				</div>
			</div>
		</div>
	);
}
