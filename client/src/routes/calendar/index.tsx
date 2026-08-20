// src/routes/calendar/index.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { Calendar } from '#/components/calendar/Calendar'
import { Button } from '#/components/Button'

export const Route = createFileRoute('/calendar/')({
    component: CalendarPage,
})

function CalendarPage() {
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

            <Calendar />
        </div>
    )
}
