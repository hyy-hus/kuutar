// src/routes/_app/calendar/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { Calendar } from "#/components/calendar/Calendar";

export interface CalendarSearch {
	start?: string;
	days?: number;
	resources?: string[];
}

const getTodayYYYYMMDD = (): string => {
	const d = new Date();
	const year = d.getFullYear();
	const month = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

export const Route = createFileRoute("/_app/calendar/")({
	validateSearch: (search: Record<string, unknown>): CalendarSearch => ({
		start: typeof search.start === "string" ? search.start : getTodayYYYYMMDD(),
		days: typeof search.days === "number" ? search.days : 1,
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

	const handleSearchChange = (nextSearch: CalendarSearch) => {
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
			startStr={start || getTodayYYYYMMDD()}
			days={days || 1}
			selectedResourceIds={resources}
			onSearchChange={handleSearchChange}
		/>
	);
}
