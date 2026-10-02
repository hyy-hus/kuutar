// src/routes/_app/calendar/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Calendar } from "#/components/calendar/Calendar";
import { formatYYYYMMDD, startOfMonth, startOfWeek } from "#/utils/date";

/** Day columns side by side, or a whole month */
const VIEW_MODES = ["days", "month"] as const;
export type CalendarViewMode = (typeof VIEW_MODES)[number];

export interface CalendarSearch {
	start?: string;
	view?: CalendarViewMode;
	/** Number of day columns in the days view */
	days?: number;
	resources?: string[];
}

/** Day ranges the calendar offers */
const DAY_RANGES = [1, 3, 5, 7] as const;
const VIEW_MODE_STORAGE_KEY = "kuutar.calendar.viewMode";

const parseViewMode = (value: unknown): CalendarViewMode | undefined =>
	VIEW_MODES.find((mode) => mode === value);
const DAYS_STORAGE_KEY = "kuutar.calendar.days";

/** The date and resources last viewed in this tab, so coming back to the calendar returns there */
const VIEW_STORAGE_KEY = "kuutar.calendar.view";

interface RememberedView {
	start?: string;
	resources?: string[];
}

function readRememberedView(): RememberedView {
	try {
		const view = JSON.parse(sessionStorage.getItem(VIEW_STORAGE_KEY) ?? "{}");
		return {
			start: typeof view.start === "string" ? view.start : undefined,
			resources: Array.isArray(view.resources) ? view.resources : undefined,
		};
	} catch {
		return {};
	}
}

function rememberView(view: RememberedView) {
	try {
		sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify(view));
	} catch {
		// Not remembering is fine; the calendar just opens on today
	}
}

/** Reads the remembered day range; storage can be unavailable (e.g. private mode) */
function readStoredDays(): number | undefined {
	try {
		const stored = Number(localStorage.getItem(DAYS_STORAGE_KEY));
		return DAY_RANGES.find((d) => d === stored);
	} catch {
		return undefined;
	}
}

function storeDays(days: number) {
	try {
		localStorage.setItem(DAYS_STORAGE_KEY, String(days));
	} catch {
		// Not persisting is fine; it just falls back to the screen-based default
	}
}

/** Reads the remembered view mode; storage can be unavailable (e.g. private mode) */
function readStoredViewMode(): CalendarViewMode | undefined {
	try {
		return parseViewMode(localStorage.getItem(VIEW_MODE_STORAGE_KEY));
	} catch {
		return undefined;
	}
}

function storeViewMode(view: CalendarViewMode) {
	try {
		localStorage.setItem(VIEW_MODE_STORAGE_KEY, view);
	} catch {
		// Not persisting is fine; it just opens in the days view
	}
}

/** As many days as fit side by side: 5 on wide screens, 3 on narrower ones, 1 on mobile */
function getDaysForScreen(): number {
	if (typeof window === "undefined") return 5;
	if (window.innerWidth < 640) return 1;
	if (window.innerWidth < 1280) return 3;
	return 5;
}

export const Route = createFileRoute("/_app/calendar/")({
	validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
		// Missing start and days are filled in by the page from the user's preferences
		start: typeof search.start === "string" ? search.start : undefined,
		view: parseViewMode(search.view),
		days: typeof search.days === "number" ? search.days : undefined,
		resources: Array.isArray(search.resources)
			? (search.resources as string[])
			: typeof search.resources === "string"
				? search.resources.split(",").filter(Boolean)
				: undefined,
	}),
	component: CalendarRoutePage,
});

function CalendarRoutePage() {
	const { start, view, days, resources } = Route.useSearch();
	const navigate = Route.useNavigate();
	// Links like "back to calendar" carry no date or resources; return to what was last viewed
	const remembered =
		start === undefined || resources === undefined ? readRememberedView() : {};
	const effectiveResources = resources ?? remembered.resources;
	// The URL wins (e.g. a shared link), then the last range picked here, then what fits the screen
	const effectiveView = view ?? readStoredViewMode() ?? "days";
	const effectiveDays = days ?? readStoredDays() ?? getDaysForScreen();
	// A week view starts on Monday, a month view on the 1st, other ranges on today
	const effectiveStart =
		start ??
		remembered.start ??
		formatYYYYMMDD(
			effectiveView === "month"
				? startOfMonth()
				: effectiveDays === 7
					? startOfWeek()
					: new Date(),
		);

	const resourcesKey = effectiveResources?.join(",");
	useEffect(() => {
		rememberView({
			start: effectiveStart,
			resources: resourcesKey?.split(",").filter(Boolean),
		});
	}, [effectiveStart, resourcesKey]);

	const handleSearchChange = (nextSearch: CalendarSearch) => {
		if (nextSearch.view !== undefined) storeViewMode(nextSearch.view);
		if (nextSearch.days !== undefined) storeDays(nextSearch.days);
		navigate({
			search: (prev) => ({
				...prev,
				...nextSearch,
			}),
			replace: true,
		});
	};

	return (
		<Calendar
			startStr={effectiveStart}
			view={effectiveView}
			days={effectiveDays}
			selectedResourceIds={effectiveResources}
			onSearchChange={handleSearchChange}
		/>
	);
}
