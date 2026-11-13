import type { components } from "#/api/schema";
import {
	formatDateTimeLocal,
	formatYYYYMMDD,
	parseLocalDate,
} from "#/utils/date";
import {
	compactLocalizedText,
	type LocalizedText,
	toLocalizedText,
} from "#/utils/localizedText";
import {
	compactLocalizedRichText,
	type LocalizedRichText,
	toLocalizedRichText,
} from "#/utils/richText";

type News = components["schemas"]["News"];
type NewsInput = components["schemas"]["NewsInput"];
export type NewsVisibility = components["schemas"]["NewsVisibility"];

export type NewsState = "draft" | "scheduled" | "published";

/** Draft (no publish time), scheduled (publish time ahead) or published */
export function newsState(
	item: { published_at?: string | null },
	now: Date = new Date(),
): NewsState {
	if (!item.published_at) return "draft";
	return new Date(item.published_at) > now ? "scheduled" : "published";
}

/** True while an item is highlighted and its highlight has not ended */
export function isHighlightActive(
	item: { highlighted: boolean; highlight_until?: string | null },
	now: Date = new Date(),
): boolean {
	if (!item.highlighted) return false;
	return !item.highlight_until || new Date(item.highlight_until) > now;
}

/** Badge text for an unread count; large counts are capped */
export function formatUnreadCount(count: number): string {
	return count > 99 ? "99+" : String(count);
}

export type PublishMode = "draft" | "publish" | "schedule";

export interface NewsFormValues {
	title: LocalizedText;
	blurb: LocalizedText;
	body: LocalizedRichText;
	visibility: NewsVisibility;
	visibleGroupIds: string[];
	publishMode: PublishMode;
	/** `YYYY-MM-DDTHH:mm`, local time; used when `publishMode` is `schedule` */
	scheduledAt: string;
	highlighted: boolean;
	/** `YYYY-MM-DD`; the highlight lasts to the end of this day. Empty = until removed. */
	highlightUntil: string;
}

/** Form values for an existing item, or defaults for a new one */
export function toNewsFormValues(
	item?: News,
	now: Date = new Date(),
): NewsFormValues {
	const state = item ? newsState(item, now) : "draft";
	return {
		title: toLocalizedText(item?.title),
		blurb: toLocalizedText(item?.blurb),
		body: toLocalizedRichText(item?.body),
		visibility: item?.visibility ?? "users",
		visibleGroupIds: item?.visible_group_ids ?? [],
		publishMode:
			state === "draft"
				? "draft"
				: state === "scheduled"
					? "schedule"
					: "publish",
		scheduledAt:
			state === "scheduled" && item?.published_at
				? formatDateTimeLocal(new Date(item.published_at))
				: "",
		highlighted: item?.highlighted ?? false,
		highlightUntil: item?.highlight_until
			? // Stored as the moment the day ends, so step back to show that day
				formatYYYYMMDD(new Date(new Date(item.highlight_until).getTime() - 1))
			: "",
	};
}

/**
 * API body from form values. Publishing keeps an existing past publish time so editing does not
 * bump an item to the top; otherwise it publishes now.
 */
export function toNewsInput(
	values: NewsFormValues,
	previousPublishedAt?: string | null,
	now: Date = new Date(),
): NewsInput {
	let publishedAt: string | null = null;
	if (values.publishMode === "publish") {
		publishedAt =
			previousPublishedAt && new Date(previousPublishedAt) <= now
				? previousPublishedAt
				: now.toISOString();
	} else if (values.publishMode === "schedule" && values.scheduledAt) {
		publishedAt = new Date(values.scheduledAt).toISOString();
	}

	let highlightUntil: string | null = null;
	if (values.highlighted && values.highlightUntil) {
		const end = parseLocalDate(values.highlightUntil);
		end.setDate(end.getDate() + 1);
		highlightUntil = end.toISOString();
	}

	return {
		title: compactLocalizedText(values.title),
		blurb: compactLocalizedText(values.blurb),
		body: compactLocalizedRichText(values.body) ?? {},
		visibility: values.visibility,
		visible_group_ids:
			values.visibility === "groups" ? values.visibleGroupIds : [],
		published_at: publishedAt,
		highlighted: values.highlighted,
		highlight_until: highlightUntil,
	};
}
