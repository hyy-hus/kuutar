// src/utils/calendarUtils.ts

export interface CalendarEvent {
	id: string;
	reservationId?: string;
	restrictionId?: string;
	isRestriction?: boolean;
	title: string;
	start: Date;
	end: Date;
	resourceId: string;
	resourceName?: string;
}

export interface PlacedEvent extends CalendarEvent {
	col: number;
	span: number;
}

export const getMinutesSinceMidnight = (d: Date): number => {
	return d.getHours() * 60 + d.getMinutes();
};

export const getMinutesBetween = (start: Date, end: Date): number => {
	const diff = end.getTime() - start.getTime();
	return Math.max(1, Math.round(diff / (1000 * 60)));
};

export const startOfCurrentWeek = (): Date => {
	const now = new Date();
	const day = now.getDay();
	const diff = now.getDate() - day + (day === 0 ? -6 : 1);
	return new Date(now.setDate(diff));
};

export function layoutDay(events: CalendarEvent[]) {
	if (!events.length) return { maxCols: 1, placed: [] };

	const sorted = [...events].sort(
		(a, b) => a.start.getTime() - b.start.getTime(),
	);
	const groups: CalendarEvent[][] = [];
	let currentGroup: CalendarEvent[] = [];
	let groupEnd = 0;

	for (const evt of sorted) {
		if (currentGroup.length === 0) {
			currentGroup.push(evt);
			groupEnd = evt.end.getTime();
		} else if (evt.start.getTime() < groupEnd) {
			currentGroup.push(evt);
			if (evt.end.getTime() > groupEnd) groupEnd = evt.end.getTime();
		} else {
			groups.push(currentGroup);
			currentGroup = [evt];
			groupEnd = evt.end.getTime();
		}
	}
	if (currentGroup.length) groups.push(currentGroup);

	const placed: PlacedEvent[] = [];

	for (const group of groups) {
		const columns: CalendarEvent[][] = [];
		for (const evt of group) {
			let placedInCol = false;
			for (let i = 0; i < columns.length; i++) {
				const col = columns[i];
				const last = col[col.length - 1];
				if (last.end.getTime() <= evt.start.getTime()) {
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
									other.end.getTime() <= evt.start.getTime() ||
									other.start.getTime() >= evt.end.getTime()
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
