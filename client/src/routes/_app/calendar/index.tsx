import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Calendar } from '#/components/calendar/Calendar'
import { Button } from '#/components/Button'
import { startOfCurrentWeek } from '#/utils/calendarUtils'

export interface CalendarSearch {
    start?: string
    days?: number
    resources?: string[]
}

const formatYYYYMMDD = (d: Date) => d.toISOString().split('T')[0]

export const Route = createFileRoute('/_app/calendar/')({
    validateSearch: (search: Record<string, unknown>): CalendarSearch => {
        return {
            start: typeof search.start === 'string' ? search.start : undefined,
            days: typeof search.days === 'number' ? search.days : undefined,
            resources: Array.isArray(search.resources)
                ? (search.resources.filter((r) => typeof r === 'string') as string[])
                : typeof search.resources === 'string'
                    ? [search.resources]
                    : undefined,
        }
    },
    component: CalendarPage,
})

function CalendarPage() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()

    // Default values if URL params are missing
    const defaultStartStr = formatYYYYMMDD(startOfCurrentWeek())
    const startStr = search.start || defaultStartStr
    const days = search.days || 7
    const selectedResourceIds = search.resources

    const handleSearchChange = (nextSearch: CalendarSearch) => {
        navigate({
            search: (prev) => ({
                ...prev,
                ...nextSearch,
            }),
            replace: true,
        })
    }

    return (
        <div className="p-4 h-full flex flex-col gap-4">
            <div className="flex items-center justify-between shrink-0">
                <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                    Kalenteri
                </h1>
                <Button asChild>
                    <Link to="/reservations/create">
                        <span>Uusi varaus</span>
                        <Plus size={18} />
                    </Link>
                </Button>
            </div>

            <Calendar
                startStr={startStr}
                days={days}
                selectedResourceIds={selectedResourceIds}
                onSearchChange={handleSearchChange}
            />
        </div>
    )
}
