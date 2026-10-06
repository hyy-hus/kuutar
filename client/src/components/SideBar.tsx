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
	Mail,
	Moon,
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

	const navItems = [
		{
			to: "/",
			label: t("etusivu", "Etusivu"),
			icon: Home,
			public: true,
		},
		{
			to: "/calendar",
			label: t("kalenteri", "Kalenteri"),
			icon: Calendar,
			public: true,
		},
		{
			to: "/stats",
			label: t("tilastot", "Tilastot"),
			icon: BarChart3,
			public: true,
		},
		{
			to: "/admin/dashboard",
			label: t("yllpito", "Ylläpito"),
			icon: Shield,
			adminOnly: true,
		},
		{
			to: "/reservations",
			label: t("varaukset", "Varaukset"),
			icon: Bookmark,
			authOnly: true,
		},
		{
			to: "/restrictions",
			label: t("rajoitukset", "Rajoitukset"),
			icon: ShieldAlert,
			adminOnly: true,
		},
		{
			to: "/reservable-blocks",
			label: t("varausjaksot", "Varausjaksot"),
			icon: CalendarCheck,
			adminOnly: true,
		},
		{
			to: "/resources",
			label: t("resurssit", "Resurssit"),
			icon: Box,
			adminOnly: true,
		},
		{
			to: "/collections",
			label: t("kokoelmat", "Kokoelmat"),
			icon: Folder,
			adminOnly: true,
		},
		{
			to: "/admin/users",
			label: t("kyttjt", "Käyttäjät"),
			icon: User,
			adminOnly: true,
		},
		{
			to: "/admin/groups",
			label: t("ryhmt", "Ryhmät"),
			icon: Users,
			adminOnly: true,
		},
		{
			to: "/contracts",
			label: t("sopimukset", "Sopimukset"),
			icon: FileText,
			adminOnly: true,
		},
		{
			to: "/admin/outlook",
			label: t("outlookSynkronointi", "Outlook-synkronointi"),
			icon: CalendarSync,
			adminOnly: true,
		},
		{
			to: "/admin/email-templates",
			label: t("sahkopostipohjat", "Sähköpostipohjat"),
			icon: Mail,
			adminOnly: true,
		},
		{
			to: "/me",
			label: t("omatTiedot", "Omat tiedot"),
			icon: UserCog,
			authOnly: true,
		},
	];

	const visibleNavItems = navItems.filter((item) => {
		if (item.public) return true;
		if (item.adminOnly) return isAdmin;
		if (item.authOnly) return Boolean(user);
		return false;
	});

	return (
		<div className="flex flex-col justify-between h-full space-y-4">
			{/* Navigation Links */}
			<nav className="space-y-1">
				{visibleNavItems.map((item) => {
					const Icon = item.icon;
					return (
						<Link
							key={item.to}
							to={item.to}
							activeProps={{
								className:
									"bg-stone-800 text-stone-100 dark:bg-stone-200 dark:text-stone-900 font-bold",
							}}
							inactiveProps={{
								className:
									"text-stone-800 dark:text-stone-200 hover:bg-stone-200 dark:hover:bg-stone-800",
							}}
							className="flex items-center gap-3 px-3 py-2 text-xs font-mono rounded-md transition-colors"
						>
							<Icon size={16} className="shrink-0" />
							<span className="truncate">{item.label}</span>
						</Link>
					);
				})}
			</nav>

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
						className="w-full h-8 pl-8 pr-7 text-xs font-mono font-medium rounded-md border border-stone-300 dark:border-stone-700 bg-stone-200/60 dark:bg-stone-800/60 text-stone-900 dark:text-stone-100 appearance-none cursor-pointer hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors focus:outline-none focus:ring-1 focus:ring-purple-600"
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
	);
}
