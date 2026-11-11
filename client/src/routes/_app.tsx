// src/routes/_app.tsx
import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AuthDialog } from "#/components/AuthPopover";
import { Button } from "#/components/Button";
import { SearchBar } from "#/components/SearchBar";
import { SideBar } from "#/components/SideBar";
import type { Theme } from "#/components/ThemeSwitcher";
import { Tooltip } from "#/components/Tooltip";
import { useAppConfig } from "#/hooks/useAppConfig";
import { authKeys, fetchMe } from "#/hooks/useAuth";
import { cn } from "#/utils/cn";

export const Route = createFileRoute("/_app")({
	beforeLoad: async ({ context }) => {
		try {
			const user = await context.queryClient.ensureQueryData({
				queryKey: authKeys.me(),
				queryFn: fetchMe,
				staleTime: 1000 * 60 * 5,
			});
			return { user };
		} catch {
			return { user: null };
		}
	},
	component: AppLayout,
});

const COLLAPSED_KEY = "sidebar-collapsed";
const DESKTOP_QUERY = "(min-width: 768px)";

function readStorage(key: string): string | null {
	try {
		return localStorage.getItem(key);
	} catch {
		return null;
	}
}

function writeStorage(key: string, value: string) {
	try {
		localStorage.setItem(key, value);
	} catch {
		// Not persisting is fine; the setting resets on reload
	}
}

/** True at the `md` breakpoint and up, where the sidebar is a rail instead of a drawer */
function useIsDesktop() {
	const [isDesktop, setIsDesktop] = useState(
		() => window.matchMedia(DESKTOP_QUERY).matches,
	);
	useEffect(() => {
		const query = window.matchMedia(DESKTOP_QUERY);
		const onChange = () => setIsDesktop(query.matches);
		query.addEventListener("change", onChange);
		return () => query.removeEventListener("change", onChange);
	}, []);
	return isDesktop;
}

function AppLayout() {
	const { t } = useTranslation();
	const isDesktop = useIsDesktop();
	// Mobile drawer: closed by default and after every navigation
	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	// Desktop rail: persisted
	const [isCollapsed, setIsCollapsed] = useState(
		() => readStorage(COLLAPSED_KEY) === "true",
	);
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const { appName } = useAppConfig();

	// biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer on navigation
	useEffect(() => {
		setIsDrawerOpen(false);
	}, [pathname]);

	const toggleMenu = () => {
		if (isDesktop) {
			setIsCollapsed((prev) => {
				writeStorage(COLLAPSED_KEY, String(!prev));
				return !prev;
			});
		} else {
			setIsDrawerOpen((prev) => !prev);
		}
	};
	const menuLabel = isDesktop
		? isCollapsed
			? t("laajennaValikko", "Laajenna valikko")
			: t("tiivistaValikko", "Pienennä valikko")
		: t("toggleMenu", "Avaa/sulje valikko");
	const showRail = isDesktop && isCollapsed;

	const [theme, setTheme] = useState<Theme>(() =>
		readStorage("theme") === "dark" ? "dark" : "light",
	);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		writeStorage("theme", theme);
	}, [theme]);

	return (
		<div className="h-screen w-screen overflow-hidden flex flex-col bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100">
			{/* Header */}
			<header className="h-16 flex gap-2 items-center px-3 border-b-2 border-stone-800 dark:border-stone-600 bg-stone-100 dark:bg-stone-900 shrink-0 z-40">
				<Tooltip content={menuLabel} side="bottom">
					<Button
						variant="ghost"
						size="icon"
						onClick={toggleMenu}
						aria-label={menuLabel}
						aria-expanded={isDesktop ? !isCollapsed : isDrawerOpen}
					>
						<Menu size={20} aria-hidden="true" />
					</Button>
				</Tooltip>

				{/* Clickable Header Logo */}
				<Link to="/" className="hover:opacity-80 transition-opacity shrink-0">
					<span className="font-bold text-lg tracking-tight truncate">
						{appName}
					</span>
				</Link>

				<div className="flex-1" />

				<div className="hidden sm:block">
					<SearchBar />
				</div>
			</header>

			<AuthDialog />

			{/* Mobile Backdrop Overlay */}
			{isDrawerOpen && (
				<button
					type="button"
					className="md:hidden fixed inset-0 bg-stone-950/60 backdrop-blur-xs z-40 transition-opacity"
					onClick={() => setIsDrawerOpen(false)}
					aria-label={t("closeDrawer", "Close Drawer")}
				/>
			)}

			{/* Layout Wrapper */}
			<div className="flex-1 relative flex overflow-hidden">
				{/* Mobile Drawer & Desktop Sidebar Container */}
				<aside
					className={cn(
						"bg-stone-100 dark:bg-stone-900 transition-all duration-300 ease-in-out shrink-0 flex flex-col shadow-2xl md:shadow-none overflow-hidden",
						// Mobile fixed drawer styling
						"fixed md:static inset-y-0 left-0 z-50 h-full w-72 border-r-2 border-stone-800 dark:border-stone-600",
						isDrawerOpen
							? "translate-x-0"
							: "-translate-x-full md:translate-x-0",
						isCollapsed ? "md:w-16" : "md:w-60",
					)}
				>
					{/* Drawer Header on Mobile */}
					<div className="flex items-center justify-between p-3 border-b-2 border-stone-800 dark:border-stone-700 md:hidden">
						<span className="font-bold text-sm tracking-wide uppercase font-mono">
							{t("valikko", "Valikko")}
						</span>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setIsDrawerOpen(false)}
							aria-label={t("closeDrawer", "Close Drawer")}
						>
							<X size={18} />
						</Button>
					</div>

					<div className={cn("min-h-0 flex-1", !showRail && "md:min-w-60")}>
						<SideBar
							collapsed={showRail}
							theme={theme}
							onThemeChange={setTheme}
						/>
					</div>
				</aside>

				{/* Main Content Area */}
				<main className="flex-1 px-4 md:px-8 py-6 overflow-y-auto min-h-0 min-w-0">
					<Outlet />
				</main>
			</div>
		</div>
	);
}
