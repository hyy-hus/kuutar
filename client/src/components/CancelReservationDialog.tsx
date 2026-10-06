import { Dialog } from "radix-ui";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { useCancelReservation } from "#/hooks/useReservations";
import { Button } from "./Button";

const MAX_REASON_LENGTH = 500;

/** Confirmation dialog for cancelling a reservation, with an optional reason for the email. */
export function CancelReservationDialog({
	reservationId,
	reservationTitle,
	trigger,
	onCancelled,
}: {
	reservationId: string;
	reservationTitle: string;
	trigger: ReactNode;
	onCancelled?: () => void;
}) {
	const { t } = useTranslation();
	const [open, setOpen] = useState(false);
	const [reason, setReason] = useState("");
	const cancelReservation = useCancelReservation();

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) {
			setReason("");
			cancelReservation.reset();
		}
	};

	const handleConfirm = async () => {
		await cancelReservation.mutateAsync({ id: reservationId, reason });
		handleOpenChange(false);
		onCancelled?.();
	};

	return (
		<Dialog.Root open={open} onOpenChange={handleOpenChange}>
			<Dialog.Trigger asChild>{trigger}</Dialog.Trigger>

			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50" />
				<Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-md p-5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl z-50 focus:outline-none space-y-4">
					<div className="space-y-1">
						<Dialog.Title className="text-base font-semibold text-stone-900 dark:text-stone-100">
							{t("peruVaraus", "Peru varaus")}
						</Dialog.Title>
						<Dialog.Description className="text-xs text-stone-600 dark:text-stone-400">
							{t(
								"vahvistaVarauksenPeruutus",
								"Haluatko varmasti perua varauksen {{title}}? Varaus vapautuu ja varaajalle lähetetään ilmoitus.",
								{ title: reservationTitle },
							)}
						</Dialog.Description>
					</div>

					<label className="block space-y-1">
						<span className="text-xs font-medium text-stone-700 dark:text-stone-300">
							{t("peruutuksenSyyValinnainen", "Peruutuksen syy (valinnainen)")}
						</span>
						<textarea
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							maxLength={MAX_REASON_LENGTH}
							rows={3}
							className="w-full p-2 text-xs border border-stone-300 dark:border-stone-700 rounded-md bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100"
						/>
					</label>

					{cancelReservation.isError && (
						<p role="alert" className="text-xs text-rose-600">
							{cancelReservation.error.message}
						</p>
					)}

					<div className="flex justify-end gap-2">
						<Dialog.Close asChild>
							<Button variant="outline" size="sm">
								{t("eiPeruta", "Älä peru")}
							</Button>
						</Dialog.Close>
						<Button
							variant="danger"
							size="sm"
							onClick={handleConfirm}
							disabled={cancelReservation.isPending}
						>
							{t("peruVaraus", "Peru varaus")}
						</Button>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
