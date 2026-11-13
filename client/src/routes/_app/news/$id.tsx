import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DetailLayout } from "#/components/DetailLayout";
import { NewsChips } from "#/components/NewsChips";
import { RichTextContent } from "#/components/RichTextContent";
import { useAuth, useIsAdmin } from "#/hooks/useAuth";
import { useDeleteNews, useMarkNewsRead, useNewsItem } from "#/hooks/useNews";
import { useDateFormatter } from "#/utils/date";
import { getLocalizedString } from "#/utils/localizedText";
import { newsState } from "#/utils/news";

export const Route = createFileRoute("/_app/news/$id")({
	component: NewsDetailPage,
});

function NewsDetailPage() {
	const { t, i18n } = useTranslation();
	const { formatDateOnly } = useDateFormatter();
	const { id } = Route.useParams();
	const navigate = useNavigate();
	const { user } = useAuth();
	const { isAdmin } = useIsAdmin();
	const { data: item, isLoading, isError } = useNewsItem(id);
	const markRead = useMarkNewsRead();
	const deleteNews = useDeleteNews();

	// Opening an item marks it read; `is_read` is false only for signed-in users
	const shouldMarkRead = Boolean(user) && item?.is_read === false;
	const { mutate: markReadMutate } = markRead;
	useEffect(() => {
		if (shouldMarkRead) markReadMutate(id);
	}, [shouldMarkRead, markReadMutate, id]);

	if (isLoading)
		return (
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t("ladataanTiedotetta", "Ladataan tiedotetta...")}
			</p>
		);
	if (isError || !item)
		return (
			<Callout variant="danger">
				{t("tiedotettaEiLoytynyt", "Tiedotetta ei löytynyt.")}
			</Callout>
		);

	const handleDelete = async () => {
		if (
			confirm(
				t(
					"vahvistaTiedotteenPoisto",
					"Haluatko varmasti poistaa tämän tiedotteen?",
				),
			)
		) {
			await deleteNews.mutateAsync(id);
			navigate({ to: "/news" });
		}
	};

	const blurb = getLocalizedString(item.blurb, i18n.language);

	return (
		<DetailLayout
			title={getLocalizedString(item.title, i18n.language)}
			back={
				<BackLink to="/news">
					{t("takaisinTiedotteisiin", "Takaisin tiedotteisiin")}
				</BackLink>
			}
			subtitle={
				newsState(item) === "published"
					? t("julkaistuDate", "Julkaistu {{date}}", {
							date: formatDateOnly(item.published_at),
						})
					: undefined
			}
			status={
				isAdmin && (
					<div className="flex flex-wrap gap-1.5">
						<NewsChips item={item} />
					</div>
				)
			}
			actions={
				isAdmin && (
					<Button variant="outline" asChild>
						<Link to="/news/edit/$id" params={{ id: item.id }}>
							{t("muokkaa", "Muokkaa")}
						</Link>
					</Button>
				)
			}
			dangerZone={
				isAdmin && (
					<Button
						variant="danger-outline"
						onClick={handleDelete}
						disabled={deleteNews.isPending}
					>
						<Trash2 size={16} />
						<span>{t("poistaTiedote", "Poista tiedote")}</span>
					</Button>
				)
			}
			technical={
				isAdmin
					? {
							id: item.id,
							createdAt: item.created_at,
							updatedAt: item.updated_at,
						}
					: undefined
			}
		>
			<article className="space-y-4">
				{blurb && (
					<p className="text-base font-medium text-ink whitespace-pre-line">
						{blurb}
					</p>
				)}
				<RichTextContent value={item.body} className="text-base" />
			</article>
		</DetailLayout>
	);
}
