import { Link } from "@tanstack/react-router";
import { ChevronRight, Megaphone, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import type { NewsSummary } from "#/hooks/useNews";
import { useDateFormatter } from "#/utils/date";
import { getLocalizedString } from "#/utils/localizedText";

interface HighlightedNewsProps {
	items: NewsSummary[];
	/** Hides an item for good (marks it read); omit for guests, whose reads are not tracked */
	onDismiss?: (id: string) => void;
}

/**
 * Highlighted news on the home page: one accent-edged card per item with its blurb and a link
 * to the full text. Renders nothing when there are no items.
 */
export function HighlightedNews({ items, onDismiss }: HighlightedNewsProps) {
	const { t, i18n } = useTranslation();
	const { formatDateOnly } = useDateFormatter();

	if (items.length === 0) return null;

	return (
		<section aria-label={t("nostetutTiedotteet", "Nostetut tiedotteet")}>
			<ul className="space-y-2">
				{items.map((item) => {
					const title = getLocalizedString(item.title, i18n.language);
					const blurb = getLocalizedString(item.blurb, i18n.language);
					return (
						<li
							key={item.id}
							className="flex items-start gap-3 rounded-md border border-l-4 border-line-subtle border-l-accent bg-surface-raised p-4"
						>
							<Megaphone
								size={18}
								aria-hidden="true"
								className="mt-0.5 shrink-0 text-accent"
							/>
							<div className="min-w-0 flex-1 space-y-1">
								<p className="text-xs tabular-nums text-ink-muted">
									{t("tiedote", "Tiedote")} ·{" "}
									{formatDateOnly(item.published_at)}
								</p>
								<h2 className="text-base font-bold text-ink wrap-break-word">
									{title}
								</h2>
								{blurb && (
									<p className="text-sm text-ink-muted whitespace-pre-line">
										{blurb}
									</p>
								)}
								<Button variant="ghost" size="sm" asChild className="-ml-3">
									<Link to="/news/$id" params={{ id: item.id }}>
										<span>{t("lueLisaa", "Lue lisää")}</span>
										<span className="sr-only">: {title}</span>
										<ChevronRight size={14} aria-hidden="true" />
									</Link>
								</Button>
							</div>
							{onDismiss && (
								<Button
									variant="ghost"
									size="iconSm"
									className="-mt-1 -mr-1 shrink-0"
									aria-label={t("piilotaTiedote", "Piilota: {{title}}", {
										title,
									})}
									title={t(
										"piilotaJaMerkitseLuetuksi",
										"Piilota ja merkitse luetuksi",
									)}
									onClick={() => onDismiss(item.id)}
								>
									<X size={16} />
								</Button>
							)}
						</li>
					);
				})}
			</ul>
		</section>
	);
}
