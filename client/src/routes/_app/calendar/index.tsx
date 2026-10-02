// src/routes/_app/calendar/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "#/components/calendar/Calendar";

export interface CalendarSearch {
	start?: string;
	days?: number;
	resources?: string[];
}

/** Day ranges the calendar offers */
const DAY_RANGES = [1, 3, 5, 7] as const;
const DAYS_STORAGE_KEY = "kuutar.calendar.days";

const formatYYYYMMDD = (d: Date): string => {
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const getMondayYYYYMMDD = (): string => {
	const d = new Date();
	const day = d.getDay();
	d.setDate(d.getDate() - day + (day === 0 ? -6 : 1));
	return formatYYYYMMDD(d);
};

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
	const { start, days, resources } = Route.useSearch();
	const navigate = Route.useNavigate();
	// The URL wins (e.g. a shared link), then the last range picked here, then what fits the screen
	const effectiveDays = days ?? readStoredDays() ?? getDaysForScreen();
	// A week view starts on Monday, other ranges on today
	const effectiveStart =
		start ??
		(effectiveDays === 7 ? getMondayYYYYMMDD() : formatYYYYMMDD(new Date()));

	const handleSearchChange = (nextSearch: CalendarSearch) => {
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
			days={effectiveDays}
			selectedResourceIds={resources}
			onSearchChange={handleSearchChange}
		/>
	);
}
