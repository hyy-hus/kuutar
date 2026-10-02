import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	CheckCircle2,
	Download,
	FileJson,
	Loader2,
	Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import {
	exportReservationsToPortableJson,
	type PortableReservationImport,
	useBatchImportReservations,
	useReservations,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { useDateFormatter } from "#/utils/date";

export const Route = createFileRoute("/_app/admin/reservations")({
	component: AdminReservationsSyncPage,
});

function AdminReservationsSyncPage() {
	const { t } = useTranslation();
	const { formatDate } = useDateFormatter();
	const { data: resources } = useResources();
	const batchImport = useBatchImportReservations();

	// Export Filter State (Defaults to 90-day span)
	// Export Filter State (Defaults to ~74-day span to stay under the 91-day API limit)
	const [exportStartDate, setExportStartDate] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() - 14);
		return d.toISOString().slice(0, 10);
	});

	const [exportEndDate, setExportEndDate] = useState(() => {
		const d = new Date();
		d.setDate(d.getDate() + 60);
		return d.toISOString().slice(0, 10);
	});

	const [exportResourceId, setExportResourceId] = useState<string>("");

	// Import State
	const [rawJsonText, setRawJsonText] = useState("");
	const [parsedImportData, setParsedImportData] = useState<
		PortableReservationImport[]
	>([]);
	const [validationErrors, setValidationErrors] = useState<string[]>([]);
	const [importSuccessCount, setImportSuccessCount] = useState<number | null>(
		null,
	);

	const resourceMap = useMemo(() => {
		return new Map(resources?.map((r) => [r.id, r.name]) || []);
	}, [resources]);

	// Fetch reservations for Export
	const { data: exportReservations, isLoading: isFetchingExport } =
		useReservations({
			startDate: new Date(exportStartDate).toISOString(),
			endDate: new Date(exportEndDate).toISOString(),
			resourceId: exportResourceId || undefined,
		});

	// Handle Export Trigger
	const handleExport = () => {
		if (!exportReservations || exportReservations.length === 0) return;
		exportReservationsToPortableJson(exportReservations, resourceMap);
	};

	// Parse and validate imported JSON
	const handleParseImportJson = (content: string) => {
		setRawJsonText(content);
		setValidationErrors([]);
		setImportSuccessCount(null);

		if (!content.trim()) {
			setParsedImportData([]);
			return;
		}

		try {
			const json = JSON.parse(content);
			if (!Array.isArray(json)) {
				setValidationErrors([
					t("importMustBeArray", "JSON-syötteen pitää olla taulukko (array)."),
				]);
				setParsedImportData([]);
				return;
			}

			const errs: string[] = [];
			json.forEach((item: Partial<PortableReservationImport>, idx: number) => {
				const row = idx + 1;
				if (!item.title) {
					errs.push(
						t("riviPuuttuvaOtsikko", "Rivi {{row}}: Puuttuva otsikko (title)", {
							row,
						}),
					);
				}
				if (
					!item.occurrences ||
					!Array.isArray(item.occurrences) ||
					item.occurrences.length === 0
				) {
					errs.push(
						t(
							"riviEiAjankohtia",
							"Rivi {{row}} ({{title}}): Ei määriteltyjä ajankohtia (occurrences)",
							{ row, title: item.title || t("tuntematon", "Tuntematon") },
						),
					);
				} else {
					item.occurrences.forEach((occ, oIdx) => {
						if (!occ.resource_name) {
							errs.push(
								t(
									"riviPuuttuvaResurssinNimi",
									"Rivi {{row}}, tapahtuma {{occurrence}}: Puuttuva resurssin nimi (resource_name)",
									{ row, occurrence: oIdx + 1 },
								),
							);
						}
						if (!occ.start_time || !occ.end_time) {
							errs.push(
								t(
									"riviPuuttuvaAika",
									"Rivi {{row}}, tapahtuma {{occurrence}}: Puuttuva aloitus- tai lopetusaika",
									{ row, occurrence: oIdx + 1 },
								),
							);
						}
					});
				}
			});

			setValidationErrors(errs);
			if (errs.length === 0) {
				setParsedImportData(json as PortableReservationImport[]);
			} else {
				setParsedImportData([]);
			}
		} catch (err) {
			setValidationErrors([
				t("invalidJsonFormat", "Virheellinen JSON-muoto: {{message}}", {
					message: (err as Error).message,
				}),
			]);
			setParsedImportData([]);
		}
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const text = event.target?.result as string;
			handleParseImportJson(text);
		};
		reader.readAsText(file);
	};

	const handleExecuteImport = async () => {
		if (parsedImportData.length === 0 || validationErrors.length > 0) return;

		try {
			const report = await batchImport.mutateAsync(parsedImportData);
			setImportSuccessCount(report.imported_count);
			setParsedImportData([]);
			setRawJsonText("");
		} catch (err) {
			setValidationErrors([(err as Error).message]);
		}
	};

	return (
		<div className="max-w-5xl mx-auto space-y-8 p-4 sm:p-6">
			<div>
				<h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">
					{t("reservationsDataSync", "Varausten siirto ja synkronointi")}
				</h1>
				<p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
					{t(
						"dataSyncDescription",
						"Vie varauksia JSON-tiedostoon tai tuo varauksia eri ympäristöjen välillä käyttäen resurssien nimiä ja sähköposteja.",
					)}
				</p>
			</div>

			{/* SECTION 1: EXPORT */}
			<div className="p-4 sm:p-5 bg-stone-100/60 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg space-y-4">
				<div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm">
					<Download size={16} className="text-amber-600 dark:text-amber-500" />
					<h2>{t("exportReservations", "Vie varaukset JSON-muodossa")}</h2>
				</div>

				<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
					<div className="space-y-1">
						<label
							htmlFor="export_start_date"
							className="text-[11px] font-mono text-stone-600 dark:text-stone-400"
						>
							{t("alstartingFrom", "Alkaen")}
						</label>
						<input
							id="export_start_date"
							type="date"
							value={exportStartDate}
							onChange={(e) => setExportStartDate(e.target.value)}
							className="w-full h-8 px-2.5 text-xs font-mono bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md"
						/>
					</div>

					<div className="space-y-1">
						<label
							htmlFor="export_end_date"
							className="text-[11px] font-mono text-stone-600 dark:text-stone-400"
						>
							{t("endingAt", "Päättyen")}
						</label>
						<input
							id="export_end_date"
							type="date"
							value={exportEndDate}
							onChange={(e) => setExportEndDate(e.target.value)}
							className="w-full h-8 px-2.5 text-xs font-mono bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md"
						/>
					</div>

					<div className="space-y-1">
						<label
							htmlFor="export_resource_id"
							className="text-[11px] font-mono text-stone-600 dark:text-stone-400"
						>
							{t("resurssi", "Resurssi")}
						</label>
						<select
							id="export_resource_id"
							value={exportResourceId}
							onChange={(e) => setExportResourceId(e.target.value)}
							className="w-full h-8 px-2.5 text-xs font-mono bg-white dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-md truncate"
						>
							<option value="">
								{t("kaikkiResurssit", "Kaikki resurssit")}
							</option>
							{resources?.map((r) => (
								<option key={r.id} value={r.id}>
									{r.name}
								</option>
							))}
						</select>
					</div>
				</div>

				<div className="flex items-center justify-between pt-2 border-t border-stone-200 dark:border-stone-800">
					<span className="text-xs font-mono text-stone-500">
						{isFetchingExport
							? t("ladataan", "Ladataan...")
							: t("foundReservationsCount", "Löytyi {{count}} varausta", {
									count: exportReservations?.length || 0,
								})}
					</span>

					<Button
						size="sm"
						disabled={!exportReservations || exportReservations.length === 0}
						onClick={handleExport}
						className="bg-amber-600 hover:bg-amber-700 text-white text-xs gap-1.5"
					>
						<FileJson size={14} />
						<span>{t("downloadJsonExport", "Lataa JSON-tiedosto")}</span>
					</Button>
				</div>
			</div>

			{/* SECTION 2: IMPORT */}
			<div className="p-4 sm:p-5 bg-stone-100/60 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg space-y-4">
				<div className="flex items-center gap-2 text-stone-900 dark:text-stone-100 font-bold text-sm">
					<Upload size={16} className="text-purple-600 dark:text-purple-400" />
					<h2>{t("importReservations", "Tuo varauksia JSON-muodossa")}</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					<label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-lg cursor-pointer hover:bg-stone-200/50 dark:hover:bg-stone-800/50 transition-colors">
						<Upload size={22} className="text-stone-400 mb-1.5" />
						<span className="text-xs font-mono text-stone-600 dark:text-stone-300">
							{t("uploadJsonFile", "Lataa .json-tiedosto")}
						</span>
						<input
							type="file"
							accept=".json"
							onChange={handleFileUpload}
							className="hidden"
						/>
					</label>

					<textarea
						value={rawJsonText}
						onChange={(e) => handleParseImportJson(e.target.value)}
						placeholder='[&#10;  {&#10;    "title": "Aineistokokous",&#10;    "user_email": "matti@example.com",&#10;    "occurrences": [&#10;      {&#10;        "resource_name": "Sauna 1",&#10;        "start_time": "2026-10-01T10:00:00Z",&#10;        "end_time": "2026-10-01T12:00:00Z"&#10;      }&#10;    ]&#10;  }&#10;]'
						rows={6}
						className="w-full p-2.5 text-xs font-mono rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-950 focus:outline-none focus:ring-1 focus:ring-purple-600"
					/>
				</div>

				{/* Errors Banner */}
				{validationErrors.length > 0 && (
					<div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-md">
						<div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold text-xs mb-1.5">
							<AlertCircle size={15} />
							<span>{t("importErrors", "Tuonnin virheet:")}</span>
						</div>
						<ul className="list-disc list-inside text-xs font-mono text-rose-600 dark:text-rose-300 space-y-0.5">
							{validationErrors.map((err) => (
								<li key={err}>{err}</li>
							))}
						</ul>
					</div>
				)}

				{/* Success Notification */}
				{importSuccessCount !== null && (
					<div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-md flex items-center gap-2 text-xs font-mono text-emerald-800 dark:text-emerald-300">
						<CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
						<span>
							{t(
								"importSuccessDetails",
								"Tuonti onnistui! Lisättiin {{count}} varausta.",
								{
									count: importSuccessCount,
								},
							)}
						</span>
					</div>
				)}

				{/* Preview Table & Action */}
				{parsedImportData.length > 0 && (
					<div className="space-y-3 pt-2">
						<div className="flex items-center justify-between">
							<span className="text-xs font-mono font-semibold flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
								<CheckCircle2 size={14} />
								{t(
									"readyToImportCount",
									"Valmiina tuotavaksi: {{count}} varausta",
									{
										count: parsedImportData.length,
									},
								)}
							</span>

							<Button
								size="sm"
								disabled={batchImport.isPending}
								onClick={handleExecuteImport}
								className="bg-purple-700 hover:bg-purple-800 text-white text-xs gap-1.5"
							>
								{batchImport.isPending ? (
									<Loader2 size={14} className="animate-spin" />
								) : (
									<Upload size={14} />
								)}
								<span>
									{t("vahvistaJaTuoVaraukset", "Vahvista ja tuo varaukset")}
								</span>
							</Button>
						</div>

						<div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-x-auto max-h-60 overflow-y-auto">
							<table className="w-full text-left text-xs font-mono">
								<thead className="bg-stone-200/70 dark:bg-stone-800 text-stone-700 dark:text-stone-300 sticky top-0">
									<tr>
										<th className="p-2">{"#"}</th>
										<th className="p-2">{t("otsikko", "Otsikko")}</th>
										<th className="p-2">{t("kyttj", "Käyttäjä")}</th>
										<th className="p-2">{t("resurssi", "Resurssi")}</th>
										<th className="p-2">{t("aika", "Aika")}</th>
									</tr>
								</thead>
								<tbody>
									{parsedImportData.map((item, idx) => (
										<tr
											// biome-ignore lint/suspicious/noArrayIndexKey: static preview rows may repeat; the index is the displayed row number
											key={`import-preview-${item.title}-${idx}`}
											className="border-b border-stone-200/60 dark:border-stone-800 hover:bg-stone-100/50 dark:hover:bg-stone-800/50"
										>
											<td className="p-2 text-stone-400">{idx + 1}</td>
											<td className="p-2 font-bold">{item.title}</td>
											<td className="p-2 text-stone-600 dark:text-stone-400">
												{item.user_email ||
													t("yllapitajaOletuksena", "(Ylläpitäjä oletuksena)")}
											</td>
											<td className="p-2 font-semibold text-purple-700 dark:text-purple-300">
												{item.occurrences
													.map((o) => o.resource_name)
													.join(", ")}
											</td>
											<td className="p-2 text-stone-500">
												{item.occurrences[0]?.start_time
													? formatDate(item.occurrences[0].start_time)
													: "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
