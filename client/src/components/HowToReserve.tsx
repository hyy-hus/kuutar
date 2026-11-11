import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";

const DISMISS_KEY = "howToReserveDismissed";

function readDismissed(): boolean {
	try {
		return localStorage.getItem(DISMISS_KEY) === "1";
	} catch {
		return false;
	}
}

interface HowToReserveProps {
	/** Logged-in users can hide the card for good; guests always see it */
	dismissible?: boolean;
}

/** Compact "how to reserve" guide in three steps, shown on the start page. */
export function HowToReserve({ dismissible = false }: HowToReserveProps) {
	const { t } = useTranslation();
	const [dismissed, setDismissed] = useState(() =>
		dismissible ? readDismissed() : false,
	);

	if (dismissible && dismissed) return null;

	const steps = [
		{
			title: t("valitseResurssi", "Valitse resurssi"),
			text: t(
				"valitseResurssiKuvaus",
				"Selaa resursseja tai kalenteria ja valitse tila tai väline.",
			),
		},
		{
			title: t("valitseAika", "Valitse aika"),
			text: t(
				"valitseAikaKuvaus",
				"Katso vapaat ajat kalenterista ja täytä varauslomake.",
			),
		},
		{
			title: t("odotaVahvistus", "Odota vahvistus"),
			text: t(
				"odotaVahvistusKuvaus",
				"Osa varauksista vahvistuu heti, osan vahvistaa ylläpito. Saat tiedon sähköpostilla.",
			),
		},
	];

	return (
		<section
			aria-labelledby="how-to-reserve"
			className="space-y-3 rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900"
		>
			<div className="flex items-start justify-between gap-2">
				<h2 id="how-to-reserve" className="text-lg font-semibold">
					{t("nainVaraat", "Näin varaat")}
				</h2>
				{dismissible && (
					<Button
						variant="ghost"
						size="iconSm"
						aria-label={t("piilotaOhje", "Piilota ohje")}
						title={t("piilotaOhje", "Piilota ohje")}
						onClick={() => {
							try {
								localStorage.setItem(DISMISS_KEY, "1");
							} catch {
								// Storage can be unavailable; hiding for this visit still works
							}
							setDismissed(true);
						}}
					>
						<X size={16} />
					</Button>
				)}
			</div>
			<ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{steps.map((step, index) => (
					<li key={step.title} className="flex gap-3">
						<span
							aria-hidden="true"
							className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-900 text-xs font-bold text-stone-50 dark:bg-stone-100 dark:text-stone-900"
						>
							{index + 1}
						</span>
						<div className="min-w-0 space-y-0.5">
							<p className="text-sm font-bold">{step.title}</p>
							<p className="text-sm text-stone-600 dark:text-stone-400">
								{step.text}
							</p>
						</div>
					</li>
				))}
			</ol>
			<p className="text-sm text-stone-600 dark:text-stone-400">
				{t(
					"omatVarauksesiLoydatKohdastaOmatVaraukset",
					"Omat varauksesi löydät kohdasta",
				)}{" "}
				<Link
					to="/reservations"
					className="text-purple-700 hover:underline dark:text-purple-400"
				>
					{t("omatVaraukset", "Omat varaukset")}
				</Link>
				.
			</p>
		</section>
	);
}
