import { Scissors } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "./Button";

interface DetachOccurrenceButtonProps {
	onDetach: () => Promise<void>;
	disabled?: boolean;
}

/** Offers to split one occurrence off its recurring series, after confirming */
export function DetachOccurrenceButton({
	onDetach,
	disabled,
}: DetachOccurrenceButtonProps) {
	const { t } = useTranslation();

	return (
		<Button
			type="button"
			variant="ghost"
			size="sm"
			className="gap-1"
			disabled={disabled}
			onClick={async () => {
				if (
					confirm(
						t(
							"irrotetaankoTmAikaSarjastaSeVoidaanTmnJlkeenMuokataTaiPoistaaErikseen",
							"Irrotetaanko tämä aika sarjasta? Sen voi tämän jälkeen muokata tai poistaa erikseen.",
						),
					)
				) {
					await onDetach();
				}
			}}
		>
			<Scissors size={14} aria-hidden="true" />
			<span>{t("irrotaSarjasta", "Irrota sarjasta")}</span>
		</Button>
	);
}
