import type { Meta, StoryObj } from "@storybook/tanstack-react";
import type { CalendarEvent } from "#/utils/calendarUtils";
import { AgendaView } from "./AgendaView";

const event = (
	i: number,
	day: number,
	hour: number,
	over: Partial<CalendarEvent> = {},
): CalendarEvent => ({
	id: `e${i}`,
	reservationId: `e${i}`,
	title: ["Hallituksen kokous", "Sitsit", "Elokuvailta"][i % 3],
	start: new Date(2026, 10, day, hour),
	end: new Date(2026, 10, day, hour + 2),
	resourceId: "r1",
	resourceName: "Tila 1",
	resourceColor: ["violet", "sky", "emerald"][i % 3],
	status: i % 4 === 0 ? "pending" : "confirmed",
	...over,
});

const meta = {
	title: "Calendar/AgendaView",
	component: AgendaView,
	parameters: {
		layout: "fullscreen",
		viewport: { defaultViewport: "mobile1" },
	},
	decorators: [
		(Story) => (
			<div className="flex h-screen flex-col p-4">
				<Story />
			</div>
		),
	],
	args: {
		monthStart: new Date(2026, 10, 1),
		events: [
			event(0, 3, 10),
			event(1, 11, 8),
			event(2, 11, 15),
			event(3, 12, 18, { end: new Date(2026, 10, 13, 2) }),
		],
	},
} satisfies Meta<typeof AgendaView>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { events: [] } };
