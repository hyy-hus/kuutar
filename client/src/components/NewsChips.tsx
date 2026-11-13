import { CalendarClock, FilePen, Megaphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Chip } from "#/components/Chip";
import { StatusChip } from "#/components/StatusChip";
import { useDateFormatter } from "#/utils/date";
import type { NewsVisibility } from "#/utils/news";
import { isHighlightActive, newsState } from "#/utils/news";

interface NewsChipsProps {
	item: {
		published_at?: string | null;
		highlighted: boolean;
		highlight_until?: string | null;
		visibility: NewsVisibility;
	};
}

/**
 * Admin-facing state of a news item, only the non-default states: draft or scheduled, an active
 * highlight, and visibility narrower than everyone. Three chips at most.
 */
export function NewsChips({ item }: NewsChipsProps) {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const state = newsState(item);

	return (
		<>
			{state === "draft" && (
				<StatusChip variant="neutral" icon={FilePen}>
					{t("luonnos", "Luonnos")}
				</StatusChip>
			)}
			{state === "scheduled" && (
				<StatusChip variant="warning" icon={CalendarClock}>
					{t("ajastettuDate", "Ajastettu {{date}}", {
						date: formatDate(item.published_at),
					})}
				</StatusChip>
			)}
			{isHighlightActive(item) && (
				<StatusChip variant="info" icon={Megaphone}>
					{t("nostettu", "Nostettu")}
				</StatusChip>
			)}
			{item.visibility === "users" && (
				<Chip>{t("kirjautuneille", "Kirjautuneille")}</Chip>
			)}
			{item.visibility === "groups" && (
				<Chip>{t("valituilleRyhmille", "Valituille ryhmille")}</Chip>
			)}
		</>
	);
}
