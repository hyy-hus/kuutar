import { Check, Copy } from "lucide-react";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader, type PageHeaderProps } from "#/components/PageHeader";
import { useDateFormatter } from "#/utils/date";

export interface TechnicalInfo {
	id: string;
	/** ISO timestamp */
	createdAt?: string | null;
	/** ISO timestamp; hidden when equal to `createdAt` */
	updatedAt?: string | null;
}

export interface DetailLayoutProps
	extends Pick<
		PageHeaderProps,
		"title" | "subtitle" | "back" | "status" | "actions"
	> {
	/** Page body: L2 sections. `actions` (Muokkaa, ...) go to the header. */
	children: ReactNode;
	/** Destructive buttons (`danger-outline`) for the "Vaaralliset toiminnot" section; omit if none */
	dangerZone?: ReactNode;
	/** Entity id and timestamps for the collapsed "Tekniset tiedot" footer; omit if none */
	technical?: TechnicalInfo;
	/** `default` (max-w-3xl) unless the page needs a table or grid */
	width?: "default" | "wide";
}

/** Standard detail page: header, body, danger section, collapsed technical footer */
export function DetailLayout({
	children,
	dangerZone,
	technical,
	width = "default",
	...header
}: DetailLayoutProps) {
	const { t } = useTranslation();
	return (
		<PageContainer width={width}>
			<PageHeader {...header} />
			{children}
			{dangerZone && (
				<section className="space-y-3 rounded-md border border-dashed border-red-400 p-4 dark:border-red-700">
					<h2 className="text-lg font-semibold">
						{t("vaarallisetToiminnot", "Vaaralliset toiminnot")}
					</h2>
					<div className="flex flex-wrap gap-2">{dangerZone}</div>
				</section>
			)}
			{technical && <TechnicalFooter {...technical} />}
		</PageContainer>
	);
}

function TechnicalFooter({ id, createdAt, updatedAt }: TechnicalInfo) {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const [copied, setCopied] = useState(false);
	const showUpdated = updatedAt && updatedAt !== createdAt;

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(id);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard can be blocked; the id stays selectable in the page
		}
	};

	return (
		<details className="group text-xs text-stone-600 dark:text-stone-400">
			<summary className="focus-ring w-fit cursor-pointer select-none hover:underline">
				{t("teknisetTiedot", "Tekniset tiedot")}
			</summary>
			<dl className="mt-2 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1">
				<dt>{t("tunniste", "Tunniste")}</dt>
				<dd className="flex items-center gap-1">
					<code className="font-mono break-all">{id}</code>
					<Button
						variant="ghost"
						size="iconSm"
						aria-label={t("kopioiTunniste", "Kopioi tunniste")}
						title={t("kopioiTunniste", "Kopioi tunniste")}
						onClick={copy}
					>
						{copied ? <Check size={14} /> : <Copy size={14} />}
					</Button>
					<output className="sr-only">
						{copied ? t("kopioitu", "Kopioitu") : ""}
					</output>
				</dd>
				{createdAt && (
					<>
						<dt>{t("luotu", "Luotu:")}</dt>
						<dd className="tabular-nums">{formatDate(createdAt)}</dd>
					</>
				)}
				{showUpdated && (
					<>
						<dt>{t("muokattu", "Muokattu:")}</dt>
						<dd className="tabular-nums">{formatDate(updatedAt)}</dd>
					</>
				)}
			</dl>
		</details>
	);
}
