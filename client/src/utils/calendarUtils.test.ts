import { describe, expect, it } from "vitest";
import {
	type CalendarEvent,
	groupAgendaByDay,
	isOvernightTail,
	splitEventsByDay,
	splitOverflow,
	todayColumnIndex,
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

describe("groupAgendaByDay", () => {
	const start = new Date(2026, 10, 1);
	const at = (id: string, day: number, hour: number, over = {}) => ({
		...event(new Date(2026, 10, day, hour), new Date(2026, 10, day, hour + 1)),
		id,
		...over,
	});

	it("skips empty days and sorts each day by start time", () => {
		const groups = groupAgendaByDay(
			[at("late", 5, 20), at("early", 5, 8), at("other", 9, 12)],
			start,
			30,
		);
		expect(groups.map((g) => g.date.getDate())).toEqual([5, 9]);
		expect(groups[0].segments.map((s) => s.id)).toEqual(["early", "late"]);
	});

	it("leaves out restrictions and bookable blocks", () => {
		const groups = groupAgendaByDay(
			[
				at("r", 5, 8, { isRestriction: true }),
				at("b", 5, 9, { isBlock: true }),
			],
			start,
			30,
		);
		expect(groups).toEqual([]);
	});

	it("lists a multi-day event on each day it touches", () => {
		const groups = groupAgendaByDay(
			[event(new Date(2026, 10, 3, 10), new Date(2026, 10, 5, 16))],
			start,
			30,
		);
		expect(groups.map((g) => g.date.getDate())).toEqual([3, 4, 5]);
	});
});

describe("splitOverflow", () => {
	it("shows everything that fits", () => {
		expect(splitOverflow([1, 2, 3], 3)).toEqual({
			visible: [1, 2, 3],
			hidden: 0,
		});
	});

	it("gives the last line to the +N more link", () => {
		expect(splitOverflow([1, 2, 3, 4, 5], 3)).toEqual({
			visible: [1, 2],
			hidden: 3,
		});
	});
});

describe("todayColumnIndex", () => {
	const start = new Date(2026, 10, 9); // Monday
	it("finds today's column", () => {
		expect(todayColumnIndex(start, 5, new Date(2026, 10, 11, 14, 30))).toBe(2);
	});

	it("is -1 when today is outside the range", () => {
		expect(todayColumnIndex(start, 3, new Date(2026, 10, 12))).toBe(-1);
		expect(todayColumnIndex(start, 3, new Date(2026, 10, 8))).toBe(-1);
	});
});
