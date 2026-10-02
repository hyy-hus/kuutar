// src/utils/calendarUtils.ts

export interface CalendarEvent {
	id: string;
	reservationId?: string;
	restrictionId?: string;
	isRestriction?: boolean;
	status?: string;
	title: string;
	userName?: string;
	start: Date;
	end: Date;
	resourceId: string;
	resourceName?: string;
}

/**
 * The part of an event that falls on a single calendar day. `start` and `end`
 * are clipped to the day; `eventStart` and `eventEnd` keep the full event times.
 */
export interface DaySegment extends CalendarEvent {
	eventStart: Date;
	eventEnd: Date;
	/** The event began on an earlier day */
	continuesBefore: boolean;
	/** The event goes on past midnight */
	continuesAfter: boolean;
}

export interface PlacedEvent extends DaySegment {
	col: number;
	span: number;
}

/** Shortest duration a block is drawn as, so very short events stay readable and clickable */
export const MIN_BLOCK_MINUTES = 30;

/** End time used for laying out a segment, stretched to the minimum block length */
const getLayoutEnd = (segment: DaySegment): number =>
	Math.max(
		segment.end.getTime(),
		segment.start.getTime() + MIN_BLOCK_MINUTES * 60_000,
	);

export const getMinutesSinceMidnight = (d: Date): number => {
	return d.getHours() * 60 + d.getMinutes();
};

/**
 * Where a day segment sits on the 24-hour grid, in wall-clock minutes from midnight.
 * The grid labels clock times, so on daylight-saving days (23 or 25 hours long)
 * blocks must follow the clock rather than the elapsed time to line up with the rows.
 */
export const getSegmentGridMinutes = (
	segment: Pick<DaySegment, "start" | "end">,
): { startMins: number; endMins: number } => {
	const realStartMins = getMinutesSinceMidnight(segment.start);
	// A segment ending at the next midnight reaches the bottom of the grid
	const endsNextDay = segment.end.getDate() !== segment.start.getDate();
	const realEndMins = endsNextDay ? 1440 : getMinutesSinceMidnight(segment.end);
	// Draw short (or clock-skipped) events at least MIN_BLOCK_MINUTES tall,
	// moving them up if they would run past the bottom of the grid
	const startMins = Math.min(realStartMins, 1440 - MIN_BLOCK_MINUTES);
	const endMins = Math.max(realEndMins, startMins + MIN_BLOCK_MINUTES);
	return { startMins, endMins };
};

/** Range from Jan 1 00:00 to Dec 31 23:59:59.999 of the current year, in local time */
export const currentYearRange = (): { start: Date; end: Date } => {
	const year = new Date().getFullYear();
	return {
		start: new Date(year, 0, 1),
		end: new Date(year + 1, 0, 1, 0, 0, 0, -1),
	};
};

/**
 * Splits events into per-day segments for `days` columns starting at `rangeStart`,
 * so an event crossing midnight shows up in every day column it covers.
 */
export function splitEventsByDay(
	events: CalendarEvent[],
	rangeStart: Date,
	days: number,
): DaySegment[][] {
	return Array.from({ length: days }, (_, i) => {
		const dayStart = new Date(
			rangeStart.getFullYear(),
			rangeStart.getMonth(),
			rangeStart.getDate() + i,
		);
		const dayEnd = new Date(
			rangeStart.getFullYear(),
			rangeStart.getMonth(),
			rangeStart.getDate() + i + 1,
		);

		return events
			.filter(
				(evt) =>
					evt.start < dayEnd && (evt.end > dayStart || evt.start >= dayStart),
			)
			.map((evt) => ({
				...evt,
				start: evt.start < dayStart ? dayStart : evt.start,
				end: evt.end > dayEnd ? dayEnd : evt.end,
				eventStart: evt.start,
				eventEnd: evt.end,
				continuesBefore: evt.start < dayStart,
				continuesAfter: evt.end > dayEnd,
			}));
	});
}

export function layoutDay(events: DaySegment[]) {
	if (!events.length) return { maxCols: 1, placed: [] };

	const sorted = [...events].sort(
		(a, b) => a.start.getTime() - b.start.getTime(),
	);
	const groups: DaySegment[][] = [];
	let currentGroup: DaySegment[] = [];
	let groupEnd = 0;

	for (const evt of sorted) {
		if (currentGroup.length === 0) {
			currentGroup.push(evt);
			groupEnd = getLayoutEnd(evt);
		} else if (evt.start.getTime() < groupEnd) {
			currentGroup.push(evt);
			if (getLayoutEnd(evt) > groupEnd) groupEnd = getLayoutEnd(evt);
		} else {
			groups.push(currentGroup);
			currentGroup = [evt];
			groupEnd = getLayoutEnd(evt);
		}
	}
	if (currentGroup.length) groups.push(currentGroup);

	const placed: PlacedEvent[] = [];

	for (const group of groups) {
		const columns: DaySegment[][] = [];
		for (const evt of group) {
			let placedInCol = false;
			for (let i = 0; i < columns.length; i++) {
				const col = columns[i];
				const last = col[col.length - 1];
				if (getLayoutEnd(last) <= evt.start.getTime()) {
					col.push(evt);
					placed.push({ ...evt, col: i + 1, span: 1 });
					placedInCol = true;
					break;
				}
			}
			if (!placedInCol) {
				columns.push([evt]);
				placed.push({ ...evt, col: columns.length, span: 1 });
			}
		}

		const numCols = columns.length;
		for (const evt of placed) {
			if (group.includes(evt)) {
				let canExpand = true;
				for (let c = evt.col; c < numCols; c++) {
					const colEvts = columns[c];
					if (
						colEvts.some(
							(other) =>
								!(
									getLayoutEnd(other) <= evt.start.getTime() ||
									other.start.getTime() >= getLayoutEnd(evt)
								),
						)
					) {
						canExpand = false;
						break;
					}
				}
				if (canExpand) evt.span = numCols - evt.col + 1;
			}
		}
	}

	const maxCols = Math.max(1, ...placed.map((p) => p.col));
	return { maxCols, placed };
}
