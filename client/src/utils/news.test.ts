import { describe, expect, it } from "vitest";
import { makeNews } from "#/test/fixtures";
import {
	formatUnreadCount,
	isHighlightActive,
	type NewsFormValues,
	newsState,
	toNewsFormValues,
	toNewsInput,
} from "./news";

const now = new Date("2026-11-11T12:00:00Z");

describe("newsState", () => {
	it("tells drafts, scheduled and published items apart", () => {
		expect(newsState({ published_at: null }, now)).toBe("draft");
		expect(newsState({ published_at: "2026-11-12T00:00:00Z" }, now)).toBe(
			"scheduled",
		);
		expect(newsState({ published_at: "2026-11-10T00:00:00Z" }, now)).toBe(
			"published",
		);
	});
});

describe("isHighlightActive", () => {
	it("is active until the end time", () => {
		expect(isHighlightActive({ highlighted: false }, now)).toBe(false);
		expect(isHighlightActive({ highlighted: true }, now)).toBe(true);
		expect(
			isHighlightActive(
				{ highlighted: true, highlight_until: "2026-11-11T11:00:00Z" },
				now,
			),
		).toBe(false);
		expect(
			isHighlightActive(
				{ highlighted: true, highlight_until: "2026-11-12T00:00:00Z" },
				now,
			),
		).toBe(true);
	});
});

describe("formatUnreadCount", () => {
	it("caps at 99+", () => {
		expect(formatUnreadCount(5)).toBe("5");
		expect(formatUnreadCount(99)).toBe("99");
		expect(formatUnreadCount(100)).toBe("99+");
	});
});

const values = (overrides: Partial<NewsFormValues> = {}): NewsFormValues => ({
	title: { fi: " Otsikko ", sv: "" },
	blurb: {},
	body: {},
	visibility: "public",
	visibleGroupIds: ["g1"],
	publishMode: "draft",
	scheduledAt: "",
	highlighted: false,
	highlightUntil: "2026-12-01",
	...overrides,
});

describe("toNewsInput", () => {
	it("keeps drafts unpublished and drops unused fields", () => {
		const input = toNewsInput(values(), undefined, now);
		expect(input.title).toEqual({ fi: "Otsikko" });
		expect(input.published_at).toBeNull();
		expect(input.visible_group_ids).toEqual([]);
		expect(input.highlight_until).toBeNull();
	});

	it("publishes now, but keeps an earlier publish time on edit", () => {
		expect(
			toNewsInput(values({ publishMode: "publish" }), null, now).published_at,
		).toBe(now.toISOString());
		expect(
			toNewsInput(
				values({ publishMode: "publish" }),
				"2026-11-01T08:00:00Z",
				now,
			).published_at,
		).toBe("2026-11-01T08:00:00Z");
		// Publishing a scheduled item right away uses the current time
		expect(
			toNewsInput(
				values({ publishMode: "publish" }),
				"2026-11-20T08:00:00Z",
				now,
			).published_at,
		).toBe(now.toISOString());
	});

	it("schedules for the chosen local time", () => {
		const input = toNewsInput(
			values({ publishMode: "schedule", scheduledAt: "2026-11-20T09:30" }),
			null,
			now,
		);
		expect(input.published_at).toBe(
			new Date(2026, 10, 20, 9, 30).toISOString(),
		);
	});

	it("ends a highlight after its last day", () => {
		const input = toNewsInput(values({ highlighted: true }), null, now);
		expect(input.highlight_until).toBe(new Date(2026, 11, 2).toISOString());
	});

	it("keeps groups only for group visibility", () => {
		const input = toNewsInput(values({ visibility: "groups" }), null, now);
		expect(input.visible_group_ids).toEqual(["g1"]);
	});
});

describe("toNewsFormValues", () => {
	it("defaults a new item to a draft for signed-in users", () => {
		const form = toNewsFormValues(undefined, now);
		expect(form.publishMode).toBe("draft");
		expect(form.visibility).toBe("users");
	});

	it("round-trips a highlight end date", () => {
		const until = new Date(2026, 11, 2).toISOString();
		const form = toNewsFormValues(
			makeNews({ highlighted: true, highlight_until: until }),
			now,
		);
		expect(form.highlightUntil).toBe("2026-12-01");
		expect(toNewsInput(form, null, now).highlight_until).toBe(until);
	});

	it("shows a scheduled item's time", () => {
		const at = new Date(2026, 10, 20, 9, 30).toISOString();
		const form = toNewsFormValues(makeNews({ published_at: at }), now);
		expect(form.publishMode).toBe("schedule");
		expect(form.scheduledAt).toBe("2026-11-20T09:30");
	});
});
