// src/utils/date.ts

/**
 * Formats an ISO date string or Date object into a localized date & time string.
 * e.g., "19.8.2026 klo 15.39" for Finnish or "Aug 19, 2026, 3:39 PM" for English.
 */
export function formatDate(
    dateInput?: string | Date | null,
    locale = 'fi-FI'
): string {
    if (!dateInput) return '—'

    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput

    if (isNaN(date.getTime())) return '—'

    return new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}
