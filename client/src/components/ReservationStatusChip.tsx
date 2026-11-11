import { Check, Clock, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ReservationStatus } from "#/hooks/useReservations";
import { StatusChip } from "./StatusChip";

/** Reservation state per the style guide: pending warning, confirmed success, cancelled danger */
export function ReservationStatusChip({
	status,
	className,
}: {
	status: ReservationStatus;
	className?: string;
}) {
	const { t } = useTranslation();
	switch (status) {
		case "pending":
			return (
				<StatusChip variant="warning" icon={Clock} className={className}>
					{t("odottaa", "Odottaa")}
				</StatusChip>
			);
		case "confirmed":
			return (
				<StatusChip variant="success" icon={Check} className={className}>
					{t("vahvistettu", "Vahvistettu")}
				</StatusChip>
			);
		default:
			return (
				<StatusChip variant="danger" icon={X} className={className}>
					{t("peruttu", "Peruttu")}
				</StatusChip>
			);
	}
}
