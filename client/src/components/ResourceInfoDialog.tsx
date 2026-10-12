import { Info, X } from "lucide-react";
import { Dialog } from "radix-ui";
import { useTranslation } from "react-i18next";
import type { Resource } from "#/hooks/useResorces";
import { RichTextContent } from "./RichTextContent";

/** Dialog listing the descriptions of the given resources, e.g. the ones picked in the reservation form. */
export function ResourceInfoDialog({ resources }: { resources: Resource[] }) {
	const { t } = useTranslation();

	return (
		<Dialog.Root>
			<Dialog.Trigger asChild>
				<button
					type="button"
					className="inline-flex items-center gap-1 text-xs font-medium text-purple-700 dark:text-purple-400 hover:underline"
				>
					<Info size={14} />
					{t("resurssienTiedot", "Resurssien tiedot")}
				</button>
			</Dialog.Trigger>

			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50" />
				<Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100vw-2rem)] max-w-lg max-h-[80vh] flex flex-col p-5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl z-50 focus:outline-none gap-4">
					<div className="flex items-start justify-between gap-2">
						<div className="space-y-1">
							<Dialog.Title className="text-base font-semibold text-stone-900 dark:text-stone-100">
								{t("resurssienTiedot", "Resurssien tiedot")}
							</Dialog.Title>
							<Dialog.Description className="text-xs text-stone-600 dark:text-stone-400">
								{t(
									"valitsemiesiResurssienKuvaukset",
									"Valitsemiesi resurssien kuvaukset.",
								)}
							</Dialog.Description>
						</div>
						<Dialog.Close
							aria-label={t("sulje", "Sulje")}
							className="p-1 rounded-md text-stone-500 hover:bg-stone-200 dark:hover:bg-stone-800"
						>
							<X size={16} />
						</Dialog.Close>
					</div>

					<ul className="space-y-4 overflow-y-auto min-h-0">
						{resources.map((res) => (
							<li key={res.id} className="space-y-1">
								<h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
									{res.name}
								</h3>
								<RichTextContent
									value={res.description}
									className="text-stone-700 dark:text-stone-300"
									fallback={
										<p className="text-xs text-stone-500">
											{t("eiKuvaustaSaatavilla", "Ei kuvausta saatavilla.")}
										</p>
									}
								/>
							</li>
						))}
					</ul>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
