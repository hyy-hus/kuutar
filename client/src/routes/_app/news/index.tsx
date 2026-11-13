import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCheck, Loader2, Newspaper, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { EmptyState } from "#/components/EmptyState";
import { NewsChips } from "#/components/NewsChips";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import {
	type NewsSummary,
	useMarkAllNewsRead,
	useNewsList,
	useUnreadNewsCount,
} from "#/hooks/useNews";
import { cn } from "#/utils/cn";
import { useDateFormatter } from "#/utils/date";
import { getLocalizedString } from "#/utils/localizedText";
import { newsState } from "#/utils/news";

export const Route = createFileRoute("/_app/news/")({
	component: NewsListPage,
});

function NewsListPage() {
	const { t } = useTranslation();
	const { user } = useAuth();
	const { isAdmin } = useIsAdmin();
	const { data: items, isLoading, isError } = useNewsList();
	const { data: unread = 0 } = useUnreadNewsCount({ enabled: Boolean(user) });
	const markAllRead = useMarkAllNewsRead();

	const subtitle =
		user && unread > 0
			? t("lukemattomiaCount", "{{count}} lukematonta", { count: unread })
			: items
				? t("tiedotteitaCount", "Yhteensä {{count}} tiedotetta", {
						count: items.length,
					})
				: undefined;

	return (
		<PageContainer>
			<PageHeader
				title={t("tiedotteet", "Tiedotteet")}
				subtitle={subtitle}
				actions={
					<>
						{isAdmin && (
							<Button asChild>
								<Link to="/news/create">
									<Plus size={18} />
									<span>{t("uusiTiedote", "Uusi tiedote")}</span>
								</Link>
							</Button>
						)}
						{user && unread > 0 && (
							<Button
								variant="outline"
								onClick={() => markAllRead.mutate()}
								disabled={markAllRead.isPending}
							>
								<CheckCheck size={18} />
								<span>
									{t("merkitseKaikkiLuetuiksi", "Merkitse kaikki luetuiksi")}
								</span>
							</Button>
						)}
					</>
				}
			/>

			{isLoading ? (
				<div className="flex items-center justify-center gap-2 p-8 text-stone-600 dark:text-stone-400">
					<Loader2 className="animate-spin" size={18} />
					<span className="text-sm">
						{t("ladataanTiedotteita", "Ladataan tiedotteita...")}
					</span>
				</div>
			) : isError ? (
				<Callout variant="danger">
					{t(
						"tiedotteidenHakuEpaonnistui",
						"Tiedotteiden hakeminen epäonnistui.",
					)}
				</Callout>
			) : items && items.length > 0 ? (
				<ul className="space-y-2">
					{items.map((item) => (
						<li key={item.id}>
							<NewsRow item={item} showAdminState={isAdmin} />
						</li>
					))}
				</ul>
			) : (
				<EmptyState
					icon={Newspaper}
					title={t("eiTiedotteita", "Ei tiedotteita.")}
					action={
						isAdmin && (
							<Button asChild variant="outline">
								<Link to="/news/create">
									<Plus size={16} />
									<span>{t("uusiTiedote", "Uusi tiedote")}</span>
								</Link>
							</Button>
						)
					}
				/>
			)}
		</PageContainer>
	);
}

function NewsRow({
	item,
	showAdminState,
}: {
	item: NewsSummary;
	showAdminState: boolean;
}) {
	const { t, i18n } = useTranslation();
	const { formatDateOnly } = useDateFormatter();
	const title = getLocalizedString(item.title, i18n.language);
	const blurb = getLocalizedString(item.blurb, i18n.language);
	const unread = item.is_read === false;
	const state = newsState(item);

	return (
		<Link
			to="/news/$id"
			params={{ id: item.id }}
			className="focus-ring block space-y-1 rounded-md hover-card border border-line-subtle bg-surface-raised p-4"
		>
			<div className="flex flex-wrap items-center gap-x-2 gap-y-1">
				{/* A scheduled item's chip carries its date */}
				{state !== "scheduled" && (
					<span className="text-xs tabular-nums text-ink-muted">
						{state === "published"
							? formatDateOnly(item.published_at)
							: t("eiJulkaistu", "Ei julkaistu")}
					</span>
				)}
				{showAdminState && <NewsChips item={item} />}
			</div>
			<h2 className="flex items-center gap-2 text-base text-ink">
				{unread && (
					<>
						<span
							aria-hidden="true"
							className="size-2 shrink-0 rounded-full bg-accent"
						/>
						<span className="sr-only">{t("lukematon", "Lukematon")}: </span>
					</>
				)}
				<span
					className={cn(
						"wrap-break-word",
						unread ? "font-bold" : "font-semibold",
					)}
				>
					{title}
				</span>
			</h2>
			{blurb && <p className="line-clamp-2 text-sm text-ink-muted">{blurb}</p>}
		</Link>
	);
}
