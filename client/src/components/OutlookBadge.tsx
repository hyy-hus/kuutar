import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Chip } from "./Chip";

/** Marks reservations that were imported from Outlook and are edited there */
export function OutlookBadge({ className }: { className?: string }) {
	const { t } = useTranslation();
	return (
		<Chip
			className={className}
			title={t(
				"outlookVarausOhje",
				"Tämä varaus tulee Outlookista. Muokkaa tai peru se Outlookissa.",
			)}
		>
			<Mail size={11} className="mr-1 shrink-0" />
			{"Outlook"}
		</Chip>
	);
}
