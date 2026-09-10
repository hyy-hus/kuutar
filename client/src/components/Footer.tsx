// src/components/Footer.tsx
import { Link } from "@tanstack/react-router";
import { ShieldCheck, Info, Newspaper, Loader2 } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { useHealth } from "#/hooks/useHealth";

export function Footer() {
	const { data: health, isLoading, isError } = useHealth();

	return (
		<footer className="w-full border-t-2 border-stone-800 dark:border-stone-700 bg-stone-100 dark:bg-stone-900 text-stone-700 dark:text-stone-300 mt-auto shrink-0 text-xs">
			<div className="max-w-6xl mx-auto p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
				{/* Brand & Identity */}
				<div className="space-y-3">
					<div className="flex items-start gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm">
						<span className="w-2.5 h-2.5 rounded-full bg-purple-600 dark:bg-purple-400 shrink-0 mt-1" />
						<span className="leading-tight">Varauskalenteri Kuutar</span>
					</div>
					<p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
						Nykyaikainen ja selkeä resurssien ja tilojen varausjärjestelmä.
					</p>
					<div className="pt-1">
						<a
							href="https://github.com/hyy-hus/kuutar"
							target="_blank"
							rel="noreferrer"
							className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-900 dark:text-stone-100 transition-colors font-medium text-xs border border-stone-300 dark:border-stone-700"
						>
							<SiGithub size={14} className="shrink-0" />
							<span>GitHub</span>
						</a>
					</div>
				</div>

				{/* Quick Navigation Links */}
				<div className="space-y-3">
					<h4 className="font-mono font-bold uppercase tracking-wider text-[11px] text-stone-900 dark:text-stone-100">
						Järjestelmä
					</h4>
					<ul className="space-y-2 text-xs">
						<li>
							<Link
								to="/calendar"
								className="hover:underline text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
							>
								Kalenteri
							</Link>
						</li>
						<li>
							<Link
								to="/resources"
								className="hover:underline text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
							>
								Resurssit
							</Link>
						</li>
						<li>
							<Link
								to="/collections"
								className="hover:underline text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
							>
								Kokoelmat
							</Link>
						</li>
					</ul>
				</div>

				{/* Info & Legal Pages */}
				<div className="space-y-3">
					<h4 className="font-mono font-bold uppercase tracking-wider text-[11px] text-stone-900 dark:text-stone-100">
						Tiedot & Ehdot
					</h4>
					<ul className="space-y-2 text-xs">
						<li>
							<Link
								to="/about"
								className="hover:underline flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
							>
								<Info size={14} className="shrink-0 text-stone-400" />
								<span>Tietoa meistä</span>
							</Link>
						</li>
						<li>
							<Link
								to="/news"
								className="hover:underline flex items-center gap-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
							>
								<Newspaper size={14} className="shrink-0 text-stone-400" />
								<span>Tiedotteet</span>
							</Link>
						</li>
						<li>
							<Link
								to="/privacy"
								className="hover:underline flex items-start gap-2 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100"
							>
								<ShieldCheck
									size={14}
									className="shrink-0 text-stone-400 mt-0.5"
								/>
								<span className="leading-tight">
									Tietosuoja & Rekisteriseloste
								</span>
							</Link>
						</li>
					</ul>
				</div>

				{/* Dynamic Version & Technical Info */}
				<div className="space-y-3">
					<h4 className="font-mono font-bold uppercase tracking-wider text-[11px] text-stone-900 dark:text-stone-100">
						Tila & Versio
					</h4>
					<div className="space-y-2 text-xs text-stone-600 dark:text-stone-400">
						<div className="flex items-center justify-between gap-2">
							<span>Versio</span>
							<span className="font-mono font-bold text-stone-900 dark:text-stone-100">
								{isLoading ? (
									<Loader2 size={12} className="animate-spin" />
								) : (
									(health?.version ?? "0.1.0")
								)}
							</span>
						</div>
						<div className="flex items-center justify-between gap-2">
							<span>Tila</span>
							{isLoading ? (
								<span className="inline-flex items-center gap-1.5 text-stone-500 text-[11px]">
									<Loader2 size={12} className="animate-spin" />
								</span>
							) : isError ? (
								<span className="inline-flex items-center gap-1.5 font-bold text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-300 dark:border-rose-800 text-[11px]">
									<span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
									Häiriö
								</span>
							) : (
								<span className="inline-flex items-center gap-1.5 font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-300 dark:border-emerald-800 text-[11px]">
									<span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
									Normaali
								</span>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Copyright Strip */}
			<div className="border-t border-stone-200 dark:border-stone-800 py-3 px-6 text-center sm:text-left text-[11px] text-stone-500 dark:text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-2 font-mono max-w-6xl mx-auto">
				<span>
					&copy; {new Date().getFullYear()} Helsingin yliopiston ylioppilaskunta
					(HYY)
				</span>
			</div>
		</footer>
	);
}
