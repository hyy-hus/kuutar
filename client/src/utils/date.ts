// src/utils/date.ts

import { useTranslation } from "react-i18next";

/** Maps app languages to the regional locale used for date formatting */
const DATE_LOCALES: Record<string, string> = {
	fi: "fi-FI",
	en: "en-GB",
	sv: "sv-FI",
};

type DateInput = string | Date | null | undefined;

const DATE_PARTS = new Set<Intl.DateTimeFormatPartTypes>([
	"day",
	"month",
	"year",
]);
const TIME_PARTS = new Set<Intl.DateTimeFormatPartTypes>(["hour", "minute"]);

export interface DateFormatter {
	/** Formats a date & time, e.g. "19.10.2026 klo 15.39" */
	formatDate: (dateInput?: DateInput) => string;
	/** Formats only the date, e.g. "19.10.2026" */
	formatDateOnly: (dateInput?: DateInput) => string;
	/** Formats only the time, e.g. "15.39" */
	formatTime: (dateInput?: DateInput) => string;
	/**
	 * Formats a start–end span, repeating the date for the end only when it falls on another day:
	 * "20.10.2026 klo 18.00 – 22.00" or "21.10.2026 klo 18.00 – 22.10.2026 klo 02.00"
	 */
	formatDateRange: (start?: DateInput, end?: DateInput) => string;
	/** Formats the weekday name, e.g. "maanantai" */
	formatWeekday: (dateInput?: DateInput) => string;
	/** Formats a short day & month without the year, e.g. "19.10." */
	formatDayMonth: (dateInput?: DateInput) => string;
	/** Formats the abbreviated weekday name, e.g. "ma" */
	formatWeekdayShort: (dateInput?: DateInput) => string;
	/** Formats the month and year, e.g. "lokakuu 2026" */
	formatMonthYear: (dateInput?: DateInput) => string;
}

function toDate(dateInput: DateInput): Date | null {
	if (!dateInput) return null;
	const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
	return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
	);
}

/**
 * Builds the date helpers around a single Intl formatter for the locale.
 * Date-only and time-only strings are derived from its parts so that
 * every view renders the same pattern.
 */
function createDateFormatter(locale: string): DateFormatter {
	const formatter = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "numeric",
		year: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});

	/** Joins the formatter's parts from the first to the last part of the given types */
	const formatPartsSpan = (
		date: Date,
		types: Set<Intl.DateTimeFormatPartTypes>,
	) => {
		const parts = formatter.formatToParts(date);
		const indices = parts.flatMap((p, i) => (types.has(p.type) ? [i] : []));
		return parts
			.slice(indices[0], indices[indices.length - 1] + 1)
			.map((p) => p.value)
			.join("");
	};

	const formatDate = (dateInput?: DateInput) => {
		const date = toDate(dateInput);
		return date ? formatter.format(date) : "—";
	};

	const formatDateOnly = (dateInput?: DateInput) => {
		const date = toDate(dateInput);
		return date ? formatPartsSpan(date, DATE_PARTS) : "—";
	};

	const formatTime = (dateInput?: DateInput) => {
		const date = toDate(dateInput);
		return date ? formatPartsSpan(date, TIME_PARTS) : "—";
	};

	const formatDateRange = (start?: DateInput, end?: DateInput) => {
		const startDate = toDate(start);
		const endDate = toDate(end);
		if (!startDate) return "—";
		if (!endDate) return formatDate(startDate);

		const endFormatted = isSameDay(startDate, endDate)
			? formatTime(endDate)
			: formatDate(endDate);
		return `${formatDate(startDate)} – ${endFormatted}`;
	};

	const weekdayFormatter = new Intl.DateTimeFormat(locale, { weekday: "long" });
	const dayMonthFormatter = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "numeric",
	});
	const weekdayShortFormatter = new Intl.DateTimeFormat(locale, {
		weekday: "short",
	});
	const monthYearFormatter = new Intl.DateTimeFormat(locale, {
		month: "long",
		year: "numeric",
	});

	const formatWeekday = (dateInput?: DateInput) => {
		const date = toDate(dateInput);
		return date ? weekdayFormatter.format(date) : "—";
	};

	const formatDayMonth = (dateInput?: DateInput) => {
		const date = toDate(dateInput);
		return date ? dayMonthFormatter.format(date) : "—";
	};

	const formatWeekdayShort = (dateInput?: DateInput) => {
		const date = toDate(dateInput);
		return date ? weekdayShortFormatter.format(date) : "—";
	};

	const formatMonthYear = (dateInput?: DateInput) => {
		const date = toDate(dateInput);
		return date ? monthYearFormatter.format(date) : "—";
	};

	return {
		formatDate,
		formatDateOnly,
		formatTime,
		formatDateRange,
		formatWeekday,
		formatDayMonth,
		formatWeekdayShort,
		formatMonthYear,
	};
}

const formatterCache = new Map<string, DateFormatter>();

/** Returns the shared date formatter for an app language, e.g. "fi" */
export function getDateFormatter(language: string): DateFormatter {
	const locale = DATE_LOCALES[language] ?? language;
	let formatter = formatterCache.get(locale);
	if (!formatter) {
		formatter = createDateFormatter(locale);
		formatterCache.set(locale, formatter);
	}
	return formatter;
}

/**
 * Date formatter for the selected UI language. Components must use this hook
 * (not a module-level helper) so they re-render with new formatting when the
 * language changes; the React Compiler would otherwise cache stale strings.
 */
export function useDateFormatter(): DateFormatter {
	const { i18n } = useTranslation();
	return getDateFormatter(i18n.resolvedLanguage ?? i18n.language);
}

/** Formats a Date for input[type="datetime-local"] (YYYY-MM-DDTHH:mm) in local time */
export function formatDateTimeLocal(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Formats a Date as YYYY-MM-DD in local time, e.g. for input[type="date"] or URL params */
export function formatYYYYMMDD(date: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses YYYY-MM-DD as local midnight; `new Date("YYYY-MM-DD")` would give UTC midnight */
export function parseLocalDate(dateStr: string): Date {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

/** Monday 00:00 local time of the week containing `date` */
export function startOfWeek(date: Date = new Date()): Date {
	const daysSinceMonday = (date.getDay() + 6) % 7;
	return new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate() - daysSinceMonday,
	);
}

/** Local midnight on the first day of the month containing `date` */
export function startOfMonth(date: Date = new Date()): Date {
	return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** The full weeks (Monday to Sunday) covering the month that starts at `monthStart` */
export function monthGridRange(monthStart: Date): {
	start: Date;
	days: number;
} {
	const start = startOfWeek(monthStart);
	const monthEnd = new Date(
		monthStart.getFullYear(),
		monthStart.getMonth() + 1,
		0,
	);
	const end = addDays(startOfWeek(monthEnd), 6);
	const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
	return { start, days };
}

/** Local midnight `days` calendar days after `date` (DST-safe, unlike adding 24-hour steps) */
export function addDays(date: Date, days: number): Date {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** ISO bounds from the start of local day `first` to the end of local day `last`, both included */
export function localDayRangeISO(
	first: Date,
	last: Date,
): { startISO: string; endISO: string } {
	return {
		startISO: addDays(first, 0).toISOString(),
		endISO: new Date(addDays(last, 1).getTime() - 1).toISOString(),
	};
}
