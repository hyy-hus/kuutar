import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { MonthView } from "./MonthView";

const COLORS = [
	"violet",
	"sky",
	"emerald",
	"orange",
	"pink",
	"teal",
	"#e11d48",
];
const TITLES = [
	"Hallituksen kokous",
	"Sitsit",
	"Elokuvailta",
	"Workshop",
	"Kuoroharjoitus",
];

function event(
	i: number,
	day: number,
	hour: number,
	over: Partial<CalendarEvent> = {},
): CalendarEvent {
	return {
		id: `e${i}`,
		reservationId: `e${i}`,
		title: TITLES[i % TITLES.length],
		start: new Date(2026, 10, day, hour),
		end: new Date(2026, 10, day, hour + 2),
		resourceId: `r${i % COLORS.length}`,
		resourceName: `Tila ${(i % COLORS.length) + 1}`,
		resourceColor: COLORS[i % COLORS.length],
		status: i % 5 === 0 ? "pending" : "confirmed",
		...over,
	};
}

const busy: CalendarEvent[] = Array.from({ length: 80 }, (_, i) =>
	event(i, 1 + ((i * 7) % 28), 8 + (i % 12)),
);
// A day crowded enough to overflow its cell, and a three-day loan
busy.push(...Array.from({ length: 8 }, (_, i) => event(100 + i, 11, 8 + i)));
busy.push(
	event(200, 12, 10, {
		title: "Teltan lainaus",
		end: new Date(2026, 10, 14, 16),
	}),
);

const meta = {
	title: "Calendar/MonthView",
	component: MonthView,
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="flex h-screen flex-col p-4">
				<Story />
			</div>
		),
	],
	args: { monthStart: new Date(2026, 10, 1), events: busy },
} satisfies Meta<typeof MonthView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Busy: Story = {};
export const Empty: Story = { args: { events: [] } };
