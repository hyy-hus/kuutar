// src/components/Footer.tsx

import { SiGithub } from "@icons-pack/react-simple-icons";
import { Link } from "@tanstack/react-router";
import { Loader2, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppConfig } from "#/hooks/useAppConfig";
import { useHealth } from "#/hooks/useHealth";

const linkClass =
	"text-stone-600 hover:text-stone-900 hover:underline dark:text-stone-400 dark:hover:text-stone-100";
const headingClass = "text-sm font-bold text-stone-900 dark:text-stone-100";

export function Footer() {
	const { t } = useTranslation();
	const { appName } = useAppConfig();
	const { data: health, isLoading, isError } = useHealth();

	return (
		<footer className="mt-auto w-full shrink-0 border-t-2 border-stone-800 bg-stone-100 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
			<div className="grid max-w-7xl grid-cols-1 gap-6 p-6 sm:grid-cols-2 md:p-8 lg:grid-cols-4 lg:gap-8">
				<div className="space-y-3 sm:col-span-2 lg:col-span-1">
					<p className="flex items-center gap-2 text-base font-bold text-stone-900 dark:text-stone-100">
						<span
							aria-hidden="true"
							className="h-2.5 w-2.5 shrink-0 rounded-full bg-purple-600 dark:bg-purple-400"
						/>
						<span className="min-w-0 break-words">{appName}</span>
					</p>
					<p className="text-stone-600 dark:text-stone-400">
						{t(
							"nykyaikainenJaSelkeResurssienJaTilojenVarausjrjestelm",
							"Nykyaikainen ja selkeä resurssien ja tilojen varausjärjestelmä.",
						)}
					</p>
					<a
						href="https://github.com/hyy-hus/kuutar"
						target="_blank"
						rel="noreferrer"
						className="inline-flex items-center gap-2 text-stone-600 hover:text-stone-900 hover:underline dark:text-stone-400 dark:hover:text-stone-100"
					>
						<SiGithub size={16} className="shrink-0" />
						<span>{t("github", "GitHub")}</span>
					</a>
				</div>

				<nav aria-labelledby="footer-system" className="space-y-3">
					<h2 id="footer-system" className={headingClass}>
						{t("jrjestelm", "Järjestelmä")}
					</h2>
					<ul className="space-y-2">
						<li>
							<Link to="/calendar" className={linkClass}>
								{t("kalenteri", "Kalenteri")}
							</Link>
						</li>
						<li>
							<Link to="/resources" className={linkClass}>
								{t("resurssit", "Resurssit")}
							</Link>
						</li>
						<li>
							<Link to="/collections" className={linkClass}>
								{t("kokoelmat", "Kokoelmat")}
							</Link>
						</li>
					</ul>
				</nav>

				<div className="space-y-3">
					<h2 className={headingClass}>{t("tiedotEhdot", "Tiedot & Ehdot")}</h2>
					<ul className="space-y-2">
						<li>
							<a
								href="https://hyy.fi/fi/ylioppilaskunta/helsingin-yliopiston-ylioppilaskunnan-dokumentit/tietosuojailmoitus/"
								className={`${linkClass} flex items-start gap-2`}
							>
								<ShieldCheck size={16} className="mt-0.5 shrink-0" />
								<span>
									{t(
										"tietosuojaRekisteriseloste",
										"Tietosuoja & Rekisteriseloste",
									)}
								</span>
							</a>
						</li>
					</ul>
				</div>

				<div className="space-y-3">
					<h2 className={headingClass}>{t("tilaVersio", "Tila & Versio")}</h2>
					<dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-stone-600 dark:text-stone-400">
						<dt>{t("versio", "Versio")}</dt>
						<dd className="font-mono font-bold text-stone-900 dark:text-stone-100">
							{isLoading ? (
								<Loader2 size={14} className="animate-spin" />
							) : (
								(health?.version ?? "0.1.0")
							)}
						</dd>
						<dt>{t("tila", "Tila")}</dt>
						<dd>
							{isLoading ? (
								<Loader2 size={14} className="animate-spin" />
							) : isError ? (
								<span className="inline-flex items-center gap-1.5 rounded-sm border border-status-danger-line bg-status-danger-bg px-2 py-0.5 text-xs font-medium text-status-danger-ink">
									<span className="h-1.5 w-1.5 rounded-full bg-current" />
									{t("hiri", "Häiriö")}
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 rounded-sm border border-status-success-line bg-status-success-bg px-2 py-0.5 text-xs font-medium text-status-success-ink">
									<span className="h-1.5 w-1.5 rounded-full bg-current" />
									{t("normaali", "Normaali")}
								</span>
							)}
						</dd>
					</dl>
				</div>
			</div>

			<div className="max-w-7xl border-t border-stone-200 px-6 py-3 text-xs text-stone-600 md:px-8 dark:border-stone-800 dark:text-stone-400">
				{"© "}
				{new Date().getFullYear()}{" "}
				{t(
					"helsinginYliopistonYlioppilaskuntaHyy",
					"Helsingin yliopiston ylioppilaskunta (HYY)",
				)}
			</div>
		</footer>
	);
}
