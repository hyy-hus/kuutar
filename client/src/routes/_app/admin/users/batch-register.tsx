import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import Papa from "papaparse";
import { Upload, CheckCircle2, AlertCircle, Trash2, Users } from "lucide-react";
import { useBatchCreateUsers, type CreateUserPayload } from "#/hooks/useUsers";
import { useGroups } from "#/hooks/useGroups";

export const Route = createFileRoute("/_app/admin/users/batch-register")({
	component: BatchRegisterUserPage,
});

interface ParsedRow {
	email: string;
	password?: string;
}

export function BatchRegisterUserPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const batchCreate = useBatchCreateUsers();
	const { data: groups, isLoading: isLoadingGroups } = useGroups();

	const [selectedGroupId, setSelectedGroupId] = useState<string>("");
	const [rawText, setRawText] = useState("");
	const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
	const [errors, setErrors] = useState<string[]>([]);

	const handleParseInput = (content: string) => {
		setRawText(content);
		setErrors([]);

		const results = Papa.parse<Record<string, string>>(content, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header) => header.trim().toLowerCase(),
		});

		if (results.errors.length > 0) {
			setErrors(results.errors.map((e) => `Rivi ${e.row}: ${e.message}`));
		}

		// Parse TSV/CSV rows for email and optional password
		const rows: ParsedRow[] = results.data.map((row) => ({
			email: row.email || row["sähköposti"] || Object.values(row)[0] || "",
			password: row.password || row["salasana"] || undefined,
		}));

		const validationErrors: string[] = [];
		rows.forEach((u, idx) => {
			if (!u.email || !u.email.includes("@")) {
				validationErrors.push(
					`Rivi ${idx + 1}: Virheellinen sähköposti (${u.email || "tyhjä"})`,
				);
			}
			if (u.password && u.password.length < 8) {
				validationErrors.push(
					`Rivi ${idx + 1} (${u.email}): Salasana on liian lyhyt (vähintään 8 merkkiä required).`,
				);
			}
		});

		if (validationErrors.length > 0) {
			setErrors((prev) => [...prev, ...validationErrors]);
		}

		setParsedRows(rows);
	};

	const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const reader = new FileReader();
		reader.onload = (event) => {
			const text = event.target?.result as string;
			handleParseInput(text);
		};
		reader.readAsText(file);
	};

	const handleSubmit = async () => {
		if (!selectedGroupId) {
			setErrors([
				t("selectGroupRequired", "Valitse kohderyhmä ennen tuontia."),
			]);
			return;
		}

		if (parsedRows.length === 0 || errors.length > 0) return;

		const payloads: CreateUserPayload[] = parsedRows.map((row) => ({
			email: row.email,
			password: row.password,
			group_id: selectedGroupId,
		}));

		try {
			await batchCreate.mutateAsync(payloads);
			navigate({ to: "/users" });
		} catch (err) {
			const rawMessage = (err as Error).message;
			// Split multi-line error details into individual UI bullet points
			const splitErrors = rawMessage.split("\n");
			setErrors(splitErrors);
		}
	};

	return (
		<div className="max-w-4xl mx-auto space-y-6 p-6">
			<div>
				<h1 className="text-xl font-bold tracking-tight">
					{t("batchRegisterUsers", "Käyttäjien massa-rekisteröinti")}
				</h1>
				<p className="text-sm text-stone-500 dark:text-stone-400">
					{t(
						"batchRegisterDescription",
						"Valitse kohderyhmä ja tuo käyttäjälista (email, salasana) CSV/TSV-tiedostosta tai leikepöydältä.",
					)}
				</p>
			</div>

			{/* Target Group Selector */}
			<div className="p-4 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg space-y-2">
				<label
					htmlFor="group-select"
					className="text-xs font-mono font-semibold flex items-center gap-2 text-stone-700 dark:text-stone-300"
				>
					<Users size={14} />
					{t(
						"targetGroup",
						"Valitse kohderyhmä kaikkille lisättäville käyttäjille:",
					)}
				</label>
				<select
					id="group-select"
					value={selectedGroupId}
					onChange={(e) => setSelectedGroupId(e.target.value)}
					disabled={isLoadingGroups}
					className="w-full h-9 px-3 text-xs font-mono rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-purple-600"
				>
					<option value="">
						{isLoadingGroups
							? t("loadingGroups", "Ladataan ryhmiä...")
							: t("selectGroupPlaceholder", "-- Valitse ryhmä --")}
					</option>
					{groups?.map((group) => (
						<option key={group.id} value={group.id}>
							{group.name} ({group.id})
						</option>
					))}
				</select>
			</div>

			{/* Input Methods */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-lg cursor-pointer hover:bg-stone-100 dark:hover:bg-stone-900 transition-colors">
					<Upload size={24} className="text-stone-400 mb-2" />
					<span className="text-xs font-mono text-stone-600 dark:text-stone-300">
						{t("uploadCsvFile", "Lataa .csv tai .tsv tiedosto")}
					</span>
					<input
						type="file"
						accept=".csv,.tsv,.txt"
						onChange={handleFileUpload}
						className="hidden"
					/>
				</label>

				<textarea
					value={rawText}
					onChange={(e) => handleParseInput(e.target.value)}
					placeholder="email, password&#10;matti@example.com, secret123&#10;maija@example.com, secret456"
					rows={5}
					className="w-full p-3 text-xs font-mono rounded-md border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-900 focus:outline-none focus:ring-1 focus:ring-purple-600"
				/>
			</div>

			{/* Errors Banner */}
			{errors.length > 0 && (
				<div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-md">
					<div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-semibold text-xs mb-2">
						<AlertCircle size={16} />
						<span>{t("validationErrors", "Havaittuja virheitä:")}</span>
					</div>
					<ul className="list-disc list-inside text-xs font-mono text-red-600 dark:text-red-300 space-y-1">
						{errors.map((err) => (
							<li key={err}>{err}</li>
						))}
					</ul>
				</div>
			)}

			{/* Preview Table */}
			{parsedRows.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="text-xs font-mono font-semibold flex items-center gap-1.5">
							<CheckCircle2 size={14} className="text-green-600" />
							{t("parsedCount", "Valmiina tuotavaksi")}: {parsedRows.length}{" "}
							{t("users", "käyttäjää")}
						</span>
						<button
							type="button"
							onClick={() => {
								setParsedRows([]);
								setRawText("");
								setErrors([]);
							}}
							className="text-xs font-mono text-stone-500 hover:text-red-600 flex items-center gap-1"
						>
							<Trash2 size={12} />
							{t("clear", "Tyhjennä")}
						</button>
					</div>

					<div className="border border-stone-200 dark:border-stone-800 rounded-md overflow-hidden">
						<table className="w-full text-left text-xs font-mono">
							<thead className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300">
								<tr>
									<th className="p-2 border-b border-stone-200 dark:border-stone-700">
										#
									</th>
									<th className="p-2 border-b border-stone-200 dark:border-stone-700">
										Email
									</th>
									<th className="p-2 border-b border-stone-200 dark:border-stone-700">
										Salasana
									</th>
								</tr>
							</thead>
							<tbody>
								{parsedRows.map((user, idx) => (
									<tr
										key={`import-${user.email}-${idx}`}
										className="border-b border-stone-100 dark:border-stone-800/60 hover:bg-stone-50 dark:hover:bg-stone-900/50"
									>
										<td className="p-2 text-stone-400">{idx + 1}</td>
										<td className="p-2 font-medium">{user.email}</td>
										<td className="p-2 text-stone-400">
											{user.password
												? "••••••••"
												: t("noPassword", "(Ei asetettu)")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="flex justify-end gap-3 pt-2">
						<button
							type="button"
							onClick={() => navigate({ to: "/users" })}
							className="px-4 py-2 text-xs font-mono border border-stone-300 dark:border-stone-700 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800"
						>
							{t("cancel", "Peruuta")}
						</button>
						<button
							type="button"
							disabled={
								batchCreate.isPending || !selectedGroupId || errors.length > 0
							}
							onClick={handleSubmit}
							className="px-4 py-2 text-xs font-mono font-bold bg-purple-700 hover:bg-purple-800 text-white rounded-md disabled:opacity-50 transition-colors"
						>
							{batchCreate.isPending
								? t("registering", "Luodaan käyttäjiä...")
								: t("confirmBatchImport", "Vahvista ja luo käyttäjät")}
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
