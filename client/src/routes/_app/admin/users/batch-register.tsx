import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle2, Trash2, Upload } from "lucide-react";
import Papa from "papaparse";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { FormSection } from "#/components/FormSection";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { Select } from "#/components/Select";
import { Textarea } from "#/components/Textarea";
import { useGroups } from "#/hooks/useGroups";
import {
	type BatchUserOperation,
	type UpdateUserPayload,
	useBatchUpsertUsers,
	useUsers,
} from "#/hooks/useUsers";

export const Route = createFileRoute("/_app/admin/users/batch-register")({
	component: BatchRegisterUserPage,
});

interface ParsedRow {
	email: string;
	name?: string;
	password?: string;
	contactPerson?: string;
	contactEmail?: string;
	contactPhone?: string;
}

function BatchRegisterUserPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const batchUpsert = useBatchUpsertUsers();
	const { data: groups, isLoading: isLoadingGroups } = useGroups();
	const { data: existingUsers, isLoading: isLoadingUsers } = useUsers();

	const [selectedGroupId, setSelectedGroupId] = useState<string>("");
	const [moveExisting, setMoveExisting] = useState(false);
	const [rawText, setRawText] = useState("");
	const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
	const [parseErrors, setParseErrors] = useState<string[]>([]);
	const [submitErrors, setSubmitErrors] = useState<string[]>([]);

	const existingByEmail = useMemo(
		() => new Map((existingUsers ?? []).map((u) => [u.email.toLowerCase(), u])),
		[existingUsers],
	);

	const findExisting = (email: string) =>
		existingByEmail.get(email.trim().toLowerCase());

	const createCount = parsedRows.filter((r) => !findExisting(r.email)).length;
	const updateCount = parsedRows.length - createCount;
	const needsGroup = createCount > 0 || moveExisting;

	// Rows for existing users only need the fields that are being changed;
	// rows for new users need a name and a password.
	const validationErrors = useMemo(() => {
		const out: string[] = [];
		const seen = new Set<string>();
		parsedRows.forEach((u, idx) => {
			const row = idx + 1;
			if (!u.email || !u.email.includes("@")) {
				out.push(
					t(
						"riviVirheellinenSahkoposti",
						"Rivi {{row}}: Virheellinen sähköposti ({{email}})",
						{ row, email: u.email || t("tyhja", "tyhjä") },
					),
				);
				return;
			}
			const key = u.email.trim().toLowerCase();
			if (seen.has(key)) {
				out.push(
					t(
						"riviKaksoiskappale",
						"Rivi {{row}} ({{email}}): Sähköposti esiintyy tiedostossa useammin kuin kerran.",
						{ row, email: u.email },
					),
				);
			}
			seen.add(key);

			if (!existingByEmail.has(key)) {
				if (!u.name) {
					out.push(
						t("riviPuuttuvaNimi", "Rivi {{row}} ({{email}}): Nimi puuttuu.", {
							row,
							email: u.email,
						}),
					);
				}
				if (!u.password) {
					out.push(
						t(
							"riviPuuttuvaSalasana",
							"Rivi {{row}} ({{email}}): Salasana puuttuu.",
							{ row, email: u.email },
						),
					);
				}
			}
			if (u.password && u.password.length < 8) {
				out.push(
					t(
						"riviSalasanaLiianLyhyt",
						"Rivi {{row}} ({{email}}): Salasana on liian lyhyt (vähintään 8 merkkiä).",
						{ row, email: u.email },
					),
				);
			}
			if (u.contactEmail && !u.contactEmail.includes("@")) {
				out.push(
					t(
						"riviVirheellinenYhteyssahkoposti",
						"Rivi {{row}} ({{email}}): Virheellinen yhteyssähköposti.",
						{ row, email: u.email },
					),
				);
			}
		});
		return out;
	}, [parsedRows, existingByEmail, t]);

	const errors = [...parseErrors, ...validationErrors, ...submitErrors];

	const clearAll = () => {
		setParsedRows([]);
		setRawText("");
		setParseErrors([]);
		setSubmitErrors([]);
	};

	const handleParseInput = (content: string) => {
		setRawText(content);
		setSubmitErrors([]);

		const results = Papa.parse<Record<string, string>>(content, {
			header: true,
			skipEmptyLines: true,
			transformHeader: (header) => header.trim().toLowerCase(),
		});

		setParseErrors(
			results.errors.map((e) =>
				t("riviVirhe", "Rivi {{row}}: {{message}}", {
					row: e.row,
					message: e.message,
				}),
			),
		);

		// Empty cells become undefined, i.e. "leave unchanged" for existing users
		const cell = (...values: (string | undefined)[]) =>
			values.map((v) => v?.trim()).find(Boolean) || undefined;

		setParsedRows(
			results.data.map((row) => ({
				email: cell(row.email, row.sähköposti, Object.values(row)[0]) ?? "",
				name: cell(row.name, row.nimi, row.etunimi),
				password: cell(row.password, row.salasana),
				contactPerson: cell(
					row.contact_person,
					row.contactperson,
					row.yhteyshenkilö,
				),
				contactEmail: cell(
					row.contact_email,
					row.contactemail,
					row.yhteyssähköposti,
				),
				contactPhone: cell(
					row.contact_phone,
					row.contactphone,
					row.yhteyspuhelin,
				),
			})),
		);
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
		if (needsGroup && !selectedGroupId) {
			setSubmitErrors([
				t("selectGroupRequired", "Valitse kohderyhmä ennen tuontia."),
			]);
			return;
		}

		if (parsedRows.length === 0 || errors.length > 0) return;

		const operations: BatchUserOperation[] = parsedRows.map((row) => {
			const contact: UpdateUserPayload = {
				default_contact_person: row.contactPerson,
				default_contact_email: row.contactEmail,
				default_contact_phone: row.contactPhone,
			};
			const hasContact = Boolean(
				row.contactPerson || row.contactEmail || row.contactPhone,
			);
			const existing = findExisting(row.email);

			if (existing) {
				return {
					kind: "update",
					id: existing.id,
					email: row.email,
					payload: {
						name: row.name,
						password: row.password,
						group_id: moveExisting ? selectedGroupId : undefined,
						...contact,
					},
				};
			}
			// Validation above rejects new users without a name or password
			return {
				kind: "create",
				payload: {
					email: row.email,
					name: row.name ?? "",
					password: row.password ?? "",
					group_id: selectedGroupId,
				},
				contact: hasContact ? contact : undefined,
			};
		});

		try {
			await batchUpsert.mutateAsync(operations);
			navigate({ to: "/admin/users" });
		} catch (err) {
			// Split multi-line error details into individual UI bullet points
			setSubmitErrors((err as Error).message.split("\n"));
		}
	};

	return (
		<PageContainer>
			<PageHeader
				back={
					<BackLink to="/admin/users">
						{t("takaisinKyttjiin", "Takaisin käyttäjiin")}
					</BackLink>
				}
				title={t("batchRegisterUsers", "Käyttäjien massarekisteröinti")}
				subtitle={t(
					"batchRegisterDescription",
					"Tuo käyttäjälista CSV/TSV-tiedostosta tai leikepöydältä. Uudet käyttäjät luodaan ja sähköpostilla löytyvät olemassa olevat käyttäjät päivitetään. Sarakkeet: email, name, password sekä valinnaiset contact_person, contact_email ja contact_phone. Tyhjä solu jättää olemassa olevan arvon ennalleen.",
				)}
			/>

			<FormSection title={t("kohderyhma", "Kohderyhmä")}>
				<div className="space-y-1">
					<label
						htmlFor="group-select"
						className="text-sm font-medium text-stone-900 dark:text-stone-100"
					>
						{t("targetGroup", "Valitse kohderyhmä uusille käyttäjille:")}
					</label>
					<Select
						id="group-select"
						value={selectedGroupId}
						onChange={(e) => setSelectedGroupId(e.target.value)}
						disabled={isLoadingGroups}
					>
						<option value="">
							{isLoadingGroups
								? t("ladataanRyhmia", "Ladataan ryhmiä...")
								: t("selectGroupPlaceholder", "-- Valitse ryhmä --")}
						</option>
						{groups?.map((group) => (
							<option key={group.id} value={group.id}>
								{group.name}
							</option>
						))}
					</Select>
				</div>
				<label className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-200">
					<input
						type="checkbox"
						checked={moveExisting}
						onChange={(e) => setMoveExisting(e.target.checked)}
						className="h-4 w-4 accent-purple-600"
					/>
					{t(
						"moveExistingToGroup",
						"Siirrä myös olemassa olevat käyttäjät valittuun ryhmään",
					)}
				</label>
			</FormSection>

			{/* Input Methods */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<label className="focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-purple-500 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-stone-400 p-6 transition-colors hover:bg-stone-100 dark:border-stone-600 dark:hover:bg-stone-900">
					<Upload
						size={24}
						aria-hidden="true"
						className="mb-2 text-stone-600 dark:text-stone-400"
					/>
					<span className="text-sm text-stone-700 dark:text-stone-300">
						{t("uploadCsvFile", "Lataa .csv- tai .tsv-tiedosto")}
					</span>
					<input
						type="file"
						accept=".csv,.tsv,.txt"
						onChange={handleFileUpload}
						className="sr-only"
					/>
				</label>

				<Textarea
					value={rawText}
					onChange={(e) => handleParseInput(e.target.value)}
					aria-label={t("liitaCsv", "Liitä CSV/TSV-sisältö")}
					placeholder="email, name, password, contact_person, contact_email, contact_phone&#10;matti@example.com, Matti Meikäläinen, secret123, Maija Meikäläinen, maija@example.com, 0401234567"
					rows={5}
					className="font-mono text-xs"
				/>
			</div>

			{/* Errors */}
			{errors.length > 0 && (
				<Callout
					variant="danger"
					title={t("validationErrors", "Havaittuja virheitä:")}
				>
					<ul className="list-inside list-disc space-y-1 text-xs">
						{errors.map((err) => (
							<li key={err}>{err}</li>
						))}
					</ul>
				</Callout>
			)}

			{/* Preview Table */}
			{parsedRows.length > 0 && (
				<div className="space-y-3">
					<div className="flex items-center justify-between">
						<span className="flex items-center gap-1.5 text-sm font-medium">
							<CheckCircle2
								size={14}
								aria-hidden="true"
								className="text-emerald-700 dark:text-emerald-400"
							/>
							{t(
								"valmiinaTuotavaksiKayttajia",
								"Valmiina tuotavaksi: {{count}} käyttäjää ({{create}} uutta, {{update}} päivitettävää)",
								{
									count: parsedRows.length,
									create: createCount,
									update: updateCount,
								},
							)}
						</span>
						<Button type="button" variant="ghost" size="sm" onClick={clearAll}>
							<Trash2 size={14} />
							{t("clear", "Tyhjennä")}
						</Button>
					</div>

					<div className="overflow-x-auto rounded-md border border-stone-300 bg-stone-50 dark:border-stone-700 dark:bg-stone-900">
						<table className="w-full text-left text-sm">
							<thead className="bg-stone-100 font-mono text-xs uppercase tracking-wider text-stone-700 dark:bg-stone-800 dark:text-stone-300">
								<tr>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{"#"}
									</th>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{t("shkposti", "Sähköposti")}
									</th>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{t("nimi", "Nimi")}
									</th>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{t("salasana", "Salasana")}
									</th>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{t("yhteyshenkilo", "Yhteyshenkilö")}
									</th>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{t("yhteyssahkoposti", "Yhteyssähköposti")}
									</th>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{t("yhteyspuhelin", "Puhelin")}
									</th>
									<th
										scope="col"
										className="border-b border-stone-300 p-2 font-normal dark:border-stone-700"
									>
										{t("toiminto", "Toiminto")}
									</th>
								</tr>
							</thead>
							<tbody>
								{parsedRows.map((user, idx) => (
									<tr
										// biome-ignore lint/suspicious/noArrayIndexKey: static preview rows may repeat; the index is the displayed row number
										key={`import-${user.email}-${idx}`}
										className="border-b border-stone-100 dark:border-stone-800/60 hover:bg-stone-50 dark:hover:bg-stone-900/50"
									>
										<td className="p-2 tabular-nums text-stone-600 dark:text-stone-400">
											{idx + 1}
										</td>
										<td className="p-2 font-medium">{user.email}</td>
										<td className="p-2 text-stone-700 dark:text-stone-300">
											{user.name || t("eiAsetettu", "(Ei asetettu)")}
										</td>
										<td className="p-2 text-stone-600 dark:text-stone-400">
											{user.password
												? "••••••••"
												: t("eiAsetettu", "(Ei asetettu)")}
										</td>
										<td className="p-2 text-stone-700 dark:text-stone-300">
											{user.contactPerson || "–"}
										</td>
										<td className="p-2 text-stone-700 dark:text-stone-300">
											{user.contactEmail || "–"}
										</td>
										<td className="p-2 text-stone-700 dark:text-stone-300">
											{user.contactPhone || "–"}
										</td>
										<td className="p-2">
											{findExisting(user.email)
												? t("paivita", "Päivitä")
												: t("luo", "Luo")}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>

					<div className="flex flex-wrap items-center gap-2 border-t border-stone-300 pt-4 dark:border-stone-700">
						<Button
							type="button"
							disabled={
								batchUpsert.isPending ||
								isLoadingUsers ||
								(needsGroup && !selectedGroupId) ||
								errors.length > 0
							}
							onClick={handleSubmit}
						>
							{batchUpsert.isPending
								? t("registering", "Tallennetaan käyttäjiä...")
								: t(
										"vahvistaJaTallennaKayttajat",
										"Vahvista ja tallenna käyttäjät",
									)}
						</Button>
						<Button
							type="button"
							variant="ghost"
							onClick={() => navigate({ to: "/admin/users" })}
						>
							{t("cancel", "Peruuta")}
						</Button>
					</div>
				</div>
			)}
		</PageContainer>
	);
}
