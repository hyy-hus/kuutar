// src/routes/calendar/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Calendar } from '#/components/calendar/Calendar'

export const Route = createFileRoute('/calendar/')({
    component: CalendarPage,
})

function CalendarPage() {
    return (
        <div className="p-4 space-y-4">
            <h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
                Kalenteri
            </h1>
            <Calendar />
        </div>
    )
}
