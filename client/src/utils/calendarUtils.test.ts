import { describe, expect, it } from "vitest";
import {
	type CalendarEvent,
	isOvernightTail,
	splitEventsByDay,
} from "./calendarUtils";

const event = (start: Date, end: Date): CalendarEvent => ({
	id: "e",
	title: "Event",
	start,
	end,
	resourceId: "r",
});

/** Segments of the second day for an event, given the days it is split into */
const secondDay = (e: CalendarEvent) =>
	splitEventsByDay([e], new Date(2026, 9, 5), 3)[1];

describe("isOvernightTail", () => {
	it("hides an evening event that ends by 8am", () => {
		const [segment] = secondDay(
			event(new Date(2026, 9, 5, 22), new Date(2026, 9, 6, 8)),
		);
		expect(isOvernightTail(segment)).toBe(true);
	});

	it("keeps an event running past 8am", () => {
		const [segment] = secondDay(
			event(new Date(2026, 9, 5, 22), new Date(2026, 9, 6, 8, 30)),
		);
		expect(isOvernightTail(segment)).toBe(false);
	});

	it("keeps the middle day of an event spanning several days", () => {
		const e = event(new Date(2026, 9, 5, 22), new Date(2026, 9, 7, 6));
		expect(isOvernightTail(secondDay(e)[0])).toBe(false);
	});

	it("never hides the day an event starts on", () => {
		const [segment] = splitEventsByDay(
			[event(new Date(2026, 9, 5, 22), new Date(2026, 9, 6, 2))],
			new Date(2026, 9, 5),
			1,
		)[0];
		expect(isOvernightTail(segment)).toBe(false);
	});
});
