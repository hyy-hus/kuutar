import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, FileJson, Loader2, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { DateInput } from "#/components/DateInput";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { Select } from "#/components/Select";
import { StatusChip } from "#/components/StatusChip";
import { Textarea } from "#/components/Textarea";
import {
	exportReservationsToPortableJson,
	type PortableReservationImport,
	useBatchImportReservations,
	useReservations,
} from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import {
	addDays,
	formatYYYYMMDD,
	localDayRangeISO,
	parseLocalDate,
	useDateFormatter,
} from "#/utils/date";

export const Route = createFileRoute("/_app/admin/reservations")({
	component: AdminReservationsSyncPage,
});

function AdminReservationsSyncPage() {
	const { t } = useTranslation();
	const { formatDateTime } = useDateFormatter();
	const { data: resources } = useResources();
	const batchImport = useBatchImportReservations();

	// Export Filter State (Defaults to 90-day span)
	// Export Filter State (Defaults to ~74-day span to stay under the 91-day API limit)
	const [exportStartDate, setExportStartDate] = useState(() =>
		formatYYYYMMDD(addDays(new Date(), -14)),
	);

	const [exportEndDate, setExportEndDate] = useState(() =>
		formatYYYYMMDD(addDays(new Date(), 60)),
	);

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
	// Both picked days are included in full, in local time
	const exportRange = localDayRangeISO(
		parseLocalDate(exportStartDate),
		parseLocalDate(exportEndDate),
	);
	const { data: exportReservations, isLoading: isFetchingExport } =
		useReservations({
			startDate: exportRange.startISO,
			endDate: exportRange.endISO,
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
		<PageContainer width="default">
			<PageHeader
				back={
					<BackLink to="/admin/dashboard">
						{t("takaisinHyvaksynnat", "Takaisin hyväksyntöihin")}
					</BackLink>
				}
				title={t("reservationsDataSync", "Varausten siirto ja synkronointi")}
				subtitle={t(
					"dataSyncDescription",
					"Vie varauksia JSON-tiedostoon tai tuo varauksia eri ympäristöjen välillä käyttäen resurssien nimiä ja sähköposteja.",
				)}
			/>

			{/* SECTION 1: EXPORT */}
			<section className="space-y-4 rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
				<h2 className="text-lg font-semibold">
					{t("exportReservations", "Vie varaukset JSON-muodossa")}
				</h2>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div className="space-y-1">
						<label htmlFor="export_start_date" className="text-sm font-medium">
							{t("alstartingFrom", "Alkaen")}
						</label>
						<DateInput
							id="export_start_date"
							value={exportStartDate}
							onChange={(e) => setExportStartDate(e.target.value)}
						/>
					</div>

					<div className="space-y-1">
						<label htmlFor="export_end_date" className="text-sm font-medium">
							{t("endingAt", "Päättyen")}
						</label>
						<DateInput
							id="export_end_date"
							value={exportEndDate}
							onChange={(e) => setExportEndDate(e.target.value)}
						/>
					</div>

					<div className="space-y-1">
						<label htmlFor="export_resource_id" className="text-sm font-medium">
							{t("resurssi", "Resurssi")}
						</label>
						<Select
							id="export_resource_id"
							value={exportResourceId}
							onChange={(e) => setExportResourceId(e.target.value)}
						>
							<option value="">
								{t("kaikkiResurssit", "Kaikki resurssit")}
							</option>
							{resources?.map((r) => (
								<option key={r.id} value={r.id}>
									{r.name}
								</option>
							))}
						</Select>
					</div>
				</div>

				<div className="flex flex-wrap items-center gap-3 border-t border-stone-300 pt-4 dark:border-stone-700">
					<Button
						disabled={!exportReservations || exportReservations.length === 0}
						onClick={handleExport}
					>
						<FileJson size={16} aria-hidden="true" />
						{t("downloadJsonExport", "Lataa JSON-tiedosto")}
					</Button>
					<span className="text-sm text-stone-600 tabular-nums dark:text-stone-400">
						{isFetchingExport
							? t("ladataan", "Ladataan...")
							: t("foundReservationsCount", "Löytyi {{count}} varausta", {
									count: exportReservations?.length || 0,
								})}
					</span>
				</div>
			</section>

			{/* SECTION 2: IMPORT */}
			<section className="space-y-4 rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
				<h2 className="text-lg font-semibold">
					{t("importReservations", "Tuo varauksia JSON-muodossa")}
				</h2>

				<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
					<label className="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-purple-500 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-stone-400 p-6 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-800">
						<Upload
							size={22}
							aria-hidden="true"
							className="mb-1.5 text-stone-600 dark:text-stone-400"
						/>
						<span className="text-sm text-stone-700 dark:text-stone-300">
							{t("uploadJsonFile", "Lataa .json-tiedosto")}
						</span>
						<input
							type="file"
							accept=".json"
							onChange={handleFileUpload}
							className="sr-only"
						/>
					</label>

					<Textarea
						value={rawJsonText}
						onChange={(e) => handleParseImportJson(e.target.value)}
						aria-label={t("importReservations", "Tuo varauksia JSON-muodossa")}
						placeholder='[&#10;  {&#10;    "title": "Aineistokokous",&#10;    "user_email": "matti@example.com",&#10;    "occurrences": [&#10;      {&#10;        "resource_name": "Sauna 1",&#10;        "start_time": "2026-10-01T10:00:00Z",&#10;        "end_time": "2026-10-01T12:00:00Z"&#10;      }&#10;    ]&#10;  }&#10;]'
						rows={6}
						className="font-mono text-xs"
					/>
				</div>

				{validationErrors.length > 0 && (
					<Callout
						variant="danger"
						title={t("importErrors", "Tuonnin virheet:")}
					>
						<ul className="list-inside list-disc space-y-0.5 font-mono text-xs">
							{validationErrors.map((err) => (
								<li key={err}>{err}</li>
							))}
						</ul>
					</Callout>
				)}

				{importSuccessCount !== null && (
					<Callout variant="success">
						{t(
							"importSuccessDetails",
							"Tuonti onnistui! Lisättiin {{count}} varausta.",
							{ count: importSuccessCount },
						)}
					</Callout>
				)}

				{parsedImportData.length > 0 && (
					<div className="space-y-3 pt-2">
						<div className="flex flex-wrap items-center gap-3">
							<Button
								disabled={batchImport.isPending}
								onClick={handleExecuteImport}
							>
								{batchImport.isPending ? (
									<Loader2 size={16} className="animate-spin" />
								) : (
									<Upload size={16} aria-hidden="true" />
								)}
								{t("vahvistaJaTuoVaraukset", "Vahvista ja tuo varaukset")}
							</Button>
							<StatusChip variant="success" icon={CheckCircle2}>
								{t(
									"readyToImportCount",
									"Valmiina tuotavaksi: {{count}} varausta",
									{ count: parsedImportData.length },
								)}
							</StatusChip>
						</div>

						<div className="max-h-60 overflow-auto rounded-md border border-stone-300 dark:border-stone-700">
							<table className="w-full text-left text-sm">
								<thead className="sticky top-0 bg-stone-100 font-mono text-xs uppercase tracking-wider text-stone-600 dark:bg-stone-800 dark:text-stone-400">
									<tr>
										<th className="p-2 font-normal">{"#"}</th>
										<th className="p-2 font-normal">
											{t("otsikko", "Otsikko")}
										</th>
										<th className="p-2 font-normal">
											{t("kyttj", "Käyttäjä")}
										</th>
										<th className="p-2 font-normal">
											{t("resurssi", "Resurssi")}
										</th>
										<th className="p-2 font-normal">{t("aika", "Aika")}</th>
									</tr>
								</thead>
								<tbody>
									{parsedImportData.map((item, idx) => (
										<tr
											// biome-ignore lint/suspicious/noArrayIndexKey: static preview rows may repeat; the index is the displayed row number
											key={`import-preview-${item.title}-${idx}`}
											className="border-t border-stone-200 hover:bg-stone-100 dark:border-stone-800 dark:hover:bg-stone-800/60"
										>
											<td className="p-2 text-stone-600 tabular-nums dark:text-stone-400">
												{idx + 1}
											</td>
											<td className="p-2 font-bold">{item.title}</td>
											<td className="p-2 text-stone-600 dark:text-stone-400">
												{item.user_email ||
													t("yllapitajaOletuksena", "(Ylläpitäjä oletuksena)")}
											</td>
											<td className="p-2">
												{item.occurrences
													.map((o) => o.resource_name)
													.join(", ")}
											</td>
											<td className="p-2 text-stone-600 tabular-nums dark:text-stone-400">
												{item.occurrences[0]?.start_time
													? formatDateTime(item.occurrences[0].start_time)
													: "—"}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}
			</section>
		</PageContainer>
	);
}
