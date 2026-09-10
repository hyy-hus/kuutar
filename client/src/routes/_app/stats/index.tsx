// client/src/routes/_app/stats.tsx
import { createFileRoute } from "@tanstack/react-router";
import {
	Bookmark,
	Box,
	Users,
	Clock,
	CheckCircle2,
	TrendingUp,
	Loader2,
	AlertCircle,
} from "lucide-react";
import { useStats } from "#/hooks/useStats";

export const Route = createFileRoute("/_app/stats/")({
	component: StatsPage,
});

export function StatsPage() {
	const { data: stats, isLoading, isError } = useStats();

	return (
		<div className="flex flex-col min-h-full -m-2 sm:-m-4">
			<div className="flex-1 p-2 sm:p-4 max-w-6xl mx-auto w-full space-y-6 pb-12">
				{/* Header Section */}
				<div className="space-y-1 border-b border-stone-200 dark:border-stone-800 pb-4">
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 tracking-tight">
							Tilastot
						</h1>
					</div>
					<p className="text-xs text-stone-600 dark:text-stone-400 font-mono">
						Tilastoa varausten tilanteesta
					</p>
				</div>

				{isLoading ? (
					<div className="p-12 flex flex-col items-center justify-center gap-3 text-stone-500">
						<Loader2 className="animate-spin" size={24} />
						<span className="text-xs font-mono">Ladataan tilastoja...</span>
					</div>
				) : isError ? (
					<div className="p-6 border-2 border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 rounded-md text-xs font-mono text-rose-800 dark:text-rose-300 flex items-center gap-2">
						<AlertCircle size={16} />
						<span>
							Tilastojen lataaminen epäonnistui. Yritä myöhemmin uudelleen.
						</span>
					</div>
				) : (
					<>
						{/* Summary Metric Cards */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
							<div className="p-4 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-100 dark:bg-stone-900 space-y-1">
								<div className="flex items-center justify-between text-stone-500">
									<span className="text-xs font-mono font-bold uppercase">
										Varaukset
									</span>
									<Bookmark size={16} />
								</div>
								<p className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
									{stats?.total_reservations ?? 0}
								</p>
							</div>

							<div className="p-4 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-100 dark:bg-stone-900 space-y-1">
								<div className="flex items-center justify-between text-stone-500">
									<span className="text-xs font-mono font-bold uppercase">
										Resurssit
									</span>
									<Box size={16} />
								</div>
								<p className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
									{stats?.total_resources ?? 0}
								</p>
							</div>

							<div className="p-4 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-100 dark:bg-stone-900 space-y-1">
								<div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
									<span className="text-xs font-mono font-bold uppercase">
										Odottavat
									</span>
									<Clock size={16} />
								</div>
								<p className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
									{stats?.pending_reservations ?? 0}
								</p>
							</div>

							<div className="p-4 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-100 dark:bg-stone-900 space-y-1">
								<div className="flex items-center justify-between text-stone-500">
									<span className="text-xs font-mono font-bold uppercase">
										Käyttäjät
									</span>
									<Users size={16} />
								</div>
								<p className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
									{stats?.total_users ?? 0}
								</p>
							</div>
						</div>

						{/* Visual Breakdown Grid */}
						<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
							{/* Top Reserved Resources */}
							<div className="p-5 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900 space-y-4">
								<h2 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
									<TrendingUp
										size={16}
										className="text-purple-600 dark:text-purple-400"
									/>
									<span>Suosituimmat resurssit</span>
								</h2>

								{stats?.top_resources && stats.top_resources.length > 0 ? (
									<ul className="space-y-3">
										{stats.top_resources.map((item) => {
											const maxCount =
												stats.top_resources[0]?.reservation_count || 1;
											const pct = Math.round(
												(item.reservation_count / maxCount) * 100,
											);

											return (
												<li key={item.resource_id} className="space-y-1">
													<div className="flex items-center justify-between text-xs font-mono">
														<span className="font-bold text-stone-900 dark:text-stone-100 truncate">
															{item.resource_name}
														</span>
														<span className="text-stone-500 shrink-0">
															{item.reservation_count} varaus
															{item.reservation_count !== 1 && "ta"}
														</span>
													</div>
													<div className="h-2 w-full bg-stone-200 dark:bg-stone-800 rounded-full overflow-hidden">
														<div
															className="h-full bg-purple-600 dark:bg-purple-500 rounded-full transition-all duration-500"
															style={{ width: `${pct}%` }}
														/>
													</div>
												</li>
											);
										})}
									</ul>
								) : (
									<p className="text-xs text-stone-500 font-mono">
										Ei vielä varaustilastoja saatavilla.
									</p>
								)}
							</div>

							{/* Status Distribution */}
							<div className="p-5 border-2 border-stone-800 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-900 space-y-4">
								<h2 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
									<CheckCircle2
										size={16}
										className="text-emerald-600 dark:text-emerald-400"
									/>
									<span>Varausten tilajakauma</span>
								</h2>

								<div className="space-y-3 text-xs font-mono">
									<div className="p-3 border border-stone-200 dark:border-stone-800 rounded bg-stone-100 dark:bg-stone-950 flex items-center justify-between">
										<span className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
											<span className="w-2 h-2 rounded-full bg-emerald-500" />
											Vahvistetut varaukset
										</span>
										<span className="font-bold text-stone-900 dark:text-stone-100">
											{stats?.confirmed_reservations ?? 0}
										</span>
									</div>

									<div className="p-3 border border-stone-200 dark:border-stone-800 rounded bg-stone-100 dark:bg-stone-950 flex items-center justify-between">
										<span className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
											<span className="w-2 h-2 rounded-full bg-amber-500" />
											Odottavat pyynnöt
										</span>
										<span className="font-bold text-stone-900 dark:text-stone-100">
											{stats?.pending_reservations ?? 0}
										</span>
									</div>
								</div>
							</div>
						</div>
					</>
				)}
			</div>
		</div>
	);
}
