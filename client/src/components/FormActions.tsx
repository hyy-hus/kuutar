import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { cn } from "#/utils/cn";

export interface FormActionsProps {
	/** The primary submit button ("Tallenna" / "Luo ..."), a `Button` with default variant */
	children: ReactNode;
	/** Renders a ghost "Peruuta" button after the primary one */
	onCancel?: () => void;
	/** Replaces the default cancel button, e.g. a link-styled `Button asChild` */
	cancel?: ReactNode;
	/** Why the submit is disabled, when not obvious */
	hint?: ReactNode;
	className?: string;
}

/** Bottom row of every form: primary left, cancel ghost to its right */
export function FormActions({
	children,
	onCancel,
	cancel,
	hint,
	className,
}: FormActionsProps) {
	const { t } = useTranslation();
	return (
		<div
			className={cn(
				"space-y-2 border-t border-stone-300 pt-4 dark:border-stone-700",
				className,
			)}
		>
			<div className="flex flex-wrap items-center gap-2">
				{children}
				{cancel ??
					(onCancel && (
						<Button type="button" variant="ghost" onClick={onCancel}>
							{t("cancel", "Peruuta")}
						</Button>
					))}
			</div>
			{hint && (
				<p className="text-xs text-stone-600 dark:text-stone-400">{hint}</p>
			)}
		</div>
	);
}
