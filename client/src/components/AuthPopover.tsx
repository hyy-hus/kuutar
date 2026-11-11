import { Dialog } from "radix-ui";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SignInForm } from "#/components/SignInForm";

export function AuthDialog() {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		const handleOpen = () => setIsOpen(true);

		window.addEventListener("kuutar:open-auth-dialog", handleOpen);
		return () => {
			window.removeEventListener("kuutar:open-auth-dialog", handleOpen);
		};
	}, []);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Portal>
				{/* Dark Screen Overlay */}
				<Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

				{/* Centered Modal Content */}
				<Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-80 p-5 bg-stone-50 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-lg shadow-xl z-50 focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
					<div>
						<Dialog.Title className="text-base font-semibold text-stone-900 dark:text-stone-100 mb-4">
							{t("kirjauduSisn", "Kirjaudu sisään")}
						</Dialog.Title>
						<SignInForm onSuccess={() => setIsOpen(false)} />
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
