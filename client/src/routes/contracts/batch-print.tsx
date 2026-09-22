import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Loader2, Printer } from "lucide-react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "#/api/client";
import { Button } from "#/components/Button";
import {
	type Contract,
	getLocalizedText,
	useContracts,
	usePresignDownload,
} from "#/hooks/useContracts";
import type { ReservationWithOccurrences } from "#/hooks/useReservations";
import { useResources } from "#/hooks/useResorces";
import { requireAuthGuard } from "#/utils/authGuard";
import { formatDate } from "#/utils/date";

export interface BatchPrintSearch {
	reservation_ids: string[];
}

export const Route = createFileRoute("/contracts/batch-print")({
	validateSearch: (search: Record<string, unknown>): BatchPrintSearch => ({
		reservation_ids: Array.isArray(search.reservation_ids)
			? (search.reservation_ids as string[])
			: typeof search.reservation_ids === "string"
				? search.reservation_ids.split(",").filter(Boolean)
				: [],
	}),
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: BatchPrintPage,
});

/** Helper to draw a cover page with reservation details using pdf-lib */
async function drawCoverPage(
	pdfDoc: PDFDocument,
	reservation: ReservationWithOccurrences,
	resourceMap: Map<string, string>,
	t: (key: string, fallback: string) => string,
) {
	const page = pdfDoc.addPage([595.28, 841.89]); // A4 size in points
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

	let y = 780;

	// Title
	page.drawText(t("sopimusasiakirja", "SOPIMUSASIAKIRJA").toUpperCase(), {
		x: 50,
		y,
		size: 20,
		font: fontBold,
		color: rgb(0.1, 0.1, 0.1),
	});

	y -= 25;
	page.drawText(`ID: ${reservation.id}`, {
		x: 50,
		y,
		size: 10,
		font: fontRegular,
		color: rgb(0.4, 0.4, 0.4),
	});

	y -= 20;
	page.drawLine({
		start: { x: 50, y },
		end: { x: 545, y },
		thickness: 1.5,
		color: rgb(0.2, 0.2, 0.2),
	});

	// Reservation Info Box
	y -= 40;
	page.drawText(t("varauksenTiedot", "VARAUKSEN TIEDOT").toUpperCase(), {
		x: 50,
		y,
		size: 12,
		font: fontBold,
		color: rgb(0.2, 0.2, 0.2),
	});

	y -= 20;
	page.drawText(`${t("varaus", "Varaus")}:`, {
		x: 50,
		y,
		size: 10,
		font: fontBold,
	});
	page.drawText(reservation.title || "-", {
		x: 180,
		y,
		size: 10,
		font: fontRegular,
	});

	y -= 18;
	if (reservation.description) {
		page.drawText(`${t("kuvaus", "Kuvaus")}:`, {
			x: 50,
			y,
			size: 10,
			font: fontBold,
		});
		page.drawText(reservation.description, {
			x: 180,
			y,
			size: 10,
			font: fontRegular,
		});
		y -= 18;
	}

	// Reserved resources
	const resourceNames = Array.from(
		new Set(
			(reservation.occurrences || [])
				.map((occ) => resourceMap.get(occ.resource_id) || occ.resource_id)
				.filter(Boolean),
		),
	).join(", ");

	page.drawText(`${t("varatutResurssit", "Varatut resurssit")}:`, {
		x: 50,
		y,
		size: 10,
		font: fontBold,
	});
	page.drawText(resourceNames || "-", {
		x: 180,
		y,
		size: 10,
		font: fontRegular,
	});

	// Occurrence schedule list
	y -= 35;
	page.drawText(t("varausajat", "VARAUSAJAT").toUpperCase(), {
		x: 50,
		y,
		size: 12,
		font: fontBold,
		color: rgb(0.2, 0.2, 0.2),
	});

	y -= 15;
	page.drawLine({
		start: { x: 50, y },
		end: { x: 545, y },
		thickness: 0.5,
		color: rgb(0.8, 0.8, 0.8),
	});

	y -= 20;
	for (const occ of reservation.occurrences || []) {
		if (y < 80) break; // Prevents overflow

		const resourceName = resourceMap.get(occ.resource_id) || "";
		const timeStr = `${formatDate(occ.start_time)}  ->  ${formatDate(occ.end_time)}`;

		page.drawText(timeStr, {
			x: 50,
			y,
			size: 9,
			font: fontRegular,
		});

		if (resourceName) {
			page.drawText(`(${resourceName})`, {
				x: 350,
				y,
				size: 9,
				font: fontRegular,
				color: rgb(0.4, 0.4, 0.4),
			});
		}

		y -= 16;
	}
}

/** Helper to draw a signature page using pdf-lib */
async function drawSignaturePage(
	pdfDoc: PDFDocument,
	t: (key: string, fallback: string) => string,
) {
	const page = pdfDoc.addPage([595.28, 841.89]);
	const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
	const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

	let y = 750;

	page.drawText(t("allekirjoitukset", "ALLEKIRJOITUKSET").toUpperCase(), {
		x: 50,
		y,
		size: 14,
		font: fontBold,
		color: rgb(0.1, 0.1, 0.1),
	});

	y -= 10;
	page.drawLine({
		start: { x: 50, y },
		end: { x: 545, y },
		thickness: 1,
		color: rgb(0.3, 0.3, 0.3),
	});

	y -= 80;

	// Vuokranantaja (Lessor)
	page.drawLine({
		start: { x: 50, y },
		end: { x: 260, y },
		thickness: 1,
		color: rgb(0.5, 0.5, 0.5),
	});
	page.drawText(t("vuokranantaja", "Vuokranantaja"), {
		x: 50,
		y: y - 15,
		size: 10,
		font: fontBold,
	});
	page.drawText(`${t("paivays", "Päiväys")}: ____.____.20__`, {
		x: 50,
		y: y - 35,
		size: 9,
		font: fontRegular,
		color: rgb(0.4, 0.4, 0.4),
	});

	// Vuokralainen (Lessee)
	page.drawLine({
		start: { x: 335, y },
		end: { x: 545, y },
		thickness: 1,
		color: rgb(0.5, 0.5, 0.5),
	});
	page.drawText(t("vuokralainen", "Vuokralainen"), {
		x: 335,
		y: y - 15,
		size: 10,
		font: fontBold,
	});
	page.drawText(`${t("paivays", "Päiväys")}: ____.____.20__`, {
		x: 335,
		y: y - 35,
		size: 9,
		font: fontRegular,
		color: rgb(0.4, 0.4, 0.4),
	});
}

function BatchPrintPage() {
	const { t, i18n } = useTranslation();
	const { reservation_ids } = Route.useSearch();
	const iframeRef = useRef<HTMLIFrameElement | null>(null);

	const { data: globalContracts, isLoading: loadingContracts } = useContracts({
		active_only: true,
	});
	const { data: resources, isLoading: loadingResources } = useResources();
	const presignDownload = usePresignDownload();

	const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
	const [isMerging, setIsMerging] = useState(false);
	const [mergeError, setMergeError] = useState<string | null>(null);

	const resourceMap = new Map(resources?.map((r) => [r.id, r.name]) ?? []);

	const {
		data: activeReservations,
		isLoading: loadingReservations,
		isError,
	} = useQuery<ReservationWithOccurrences[]>({
		queryKey: ["reservations", "batch", reservation_ids],
		queryFn: async () => {
			if (reservation_ids.length === 0) return [];

			const results = await Promise.all(
				reservation_ids.map(async (id) => {
					const { data, error } = await api.GET("/reservations/{id}", {
						params: { path: { id } },
					});
					if (error || !data) return null;
					return data as unknown as ReservationWithOccurrences;
				}),
			);

			return results.filter((item): item is ReservationWithOccurrences =>
				Boolean(item),
			);
		},
		enabled: reservation_ids.length > 0,
	});

	const hasRunRef = useRef(false);
	const reservationIdsKey = reservation_ids.sort().join(",");

	useEffect(() => {
		async function prepareBatchPdf() {
			if (
				hasRunRef.current ||
				!globalContracts ||
				!activeReservations ||
				activeReservations.length === 0
			) {
				return;
			}

			hasRunRef.current = true;

			try {
				setIsMerging(true);
				setMergeError(null);

				const mergedPdf = await PDFDocument.create();

				for (const reservation of activeReservations) {
					// 1. Draw Cover / Details Page for this reservation
					await drawCoverPage(mergedPdf, reservation, resourceMap, t);

					// 2. Collect unique resource IDs involved in this reservation
					const resourceIds = Array.from(
						new Set(
							(reservation.occurrences || []).map((occ) => occ.resource_id),
						),
					);

					// 3. Fetch resource-specific contracts for all involved resources
					const contractMap = new Map<string, Contract>();

					// Add global active contracts
					for (const gc of globalContracts) {
						if (gc.is_global) {
							contractMap.set(gc.id, gc);
						}
					}

					// Query GET /contracts?resource_id={rId} to get resource-bound contracts
					await Promise.all(
						resourceIds.map(async (rId) => {
							const { data, error } = await api.GET("/contracts", {
								params: { query: { resource_id: rId, active_only: true } },
							});
							if (!error && data) {
								for (const c of data as Contract[]) {
									contractMap.set(c.id, c);
								}
							}
						}),
					);

					const applicableContracts = Array.from(contractMap.values());

					// 4. Download and append all applicable contract PDFs
					for (const contract of applicableContracts) {
						const s3KeyMap = (contract.s3_key as Record<string, string>) || {};
						const s3Key =
							s3KeyMap[i18n.language] ||
							s3KeyMap.fi ||
							s3KeyMap.en ||
							Object.values(s3KeyMap)[0];

						if (!s3Key) continue;

						const downloadUrl = await presignDownload.mutateAsync(s3Key);
						const pdfResponse = await fetch(downloadUrl);

						if (!pdfResponse.ok) {
							throw new Error(
								t(
									"pdfLatausVirhe",
									"Sopimustiedoston lataaminen epäonnistui: {{title}}",
									{ title: getLocalizedText(contract.title, i18n.language) },
								),
							);
						}

						const pdfBytes = await pdfResponse.arrayBuffer();
						const sourceDoc = await PDFDocument.load(pdfBytes);
						const copiedPages = await mergedPdf.copyPages(
							sourceDoc,
							sourceDoc.getPageIndices(),
						);

						for (const page of copiedPages) {
							mergedPdf.addPage(page);
						}
					}

					// 5. Draw Signature Page for this reservation
					await drawSignaturePage(mergedPdf, t);
				}

				const mergedBytes = await mergedPdf.save();
				const blob = new Blob([mergedBytes.buffer as ArrayBuffer], {
					type: "application/pdf",
				});
				const blobUrl = URL.createObjectURL(blob);

				setMergedPdfUrl(blobUrl);
			} catch (err) {
				setMergeError((err as Error).message);
			} finally {
				setIsMerging(false);
			}
		}

		prepareBatchPdf();
	}, [globalContracts, activeReservations, i18n.language, reservationIdsKey]);

	const handleTriggerPrint = () => {
		if (iframeRef.current?.contentWindow) {
			iframeRef.current.contentWindow.focus();
			iframeRef.current.contentWindow.print();
		}
	};

	if (
		loadingContracts ||
		loadingResources ||
		loadingReservations ||
		isMerging
	) {
		return (
			<div className="p-12 flex flex-col items-center justify-center gap-3 text-stone-500 font-mono text-sm">
				<Loader2 className="animate-spin text-amber-600" size={24} />
				<span>
					{t(
						"kootaanLiitettyjaSopimuksia",
						"Kootaan varauksiin liitettyjä sopimusasiakirjoja...",
					)}
				</span>
			</div>
		);
	}

	if (
		isError ||
		mergeError ||
		!activeReservations ||
		activeReservations.length === 0
	) {
		return (
			<div className="p-8 text-center text-rose-600 font-semibold text-sm max-w-md mx-auto space-y-2">
				<AlertTriangle size={24} className="mx-auto text-rose-500" />
				<p>
					{mergeError ||
						t(
							"valittujaVarauksiaEiLytynyt",
							"Valittuja varauksia ei löytynyt.",
						)}
				</p>
			</div>
		);
	}

	return (
		<div className="p-6 max-w-5xl mx-auto space-y-4">
			<div className="flex items-center justify-between p-4 bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-md">
				<div>
					<h1 className="font-bold text-stone-900 dark:text-stone-100 text-base">
						{t("sopimustenEratulostus", "Sopimusten erätulostus")}
					</h1>
					<p className="text-xs text-stone-500">
						{t("yhteensaVarauksia", "Kootut sopimukset {{count}} varaukselle", {
							count: activeReservations.length,
						})}
					</p>
				</div>

				<Button
					onClick={handleTriggerPrint}
					className="bg-amber-600 hover:bg-amber-700 text-white gap-2"
				>
					<Printer size={16} />
					<span>{t("tulostaPdf", "Avaa tulostusikkuna")}</span>
				</Button>
			</div>

			{mergedPdfUrl && (
				<iframe
					ref={iframeRef}
					src={mergedPdfUrl}
					title="Batch PDF Print"
					className="w-full h-[80vh] border border-stone-300 dark:border-stone-800 rounded-md"
				/>
			)}
		</div>
	);
}
