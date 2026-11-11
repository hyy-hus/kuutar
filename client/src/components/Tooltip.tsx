import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactElement, ReactNode } from "react";

interface TooltipProps {
	/** Text shown on hover and keyboard focus */
	content: ReactNode;
	/** The trigger; must accept a ref and DOM props (a button or link) */
	children: ReactElement;
	side?: "top" | "right" | "bottom" | "left";
}

/** Small label next to an icon-only control. Pair it with an `aria-label` on the trigger. */
export function Tooltip({ content, children, side = "right" }: TooltipProps) {
	return (
		<RadixTooltip.Provider delayDuration={200}>
			<RadixTooltip.Root>
				<RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
				<RadixTooltip.Portal>
					<RadixTooltip.Content
						side={side}
						sideOffset={8}
						className="z-[60] max-w-60 rounded-md bg-stone-900 px-2.5 py-1.5 text-xs font-medium text-stone-50 dark:bg-stone-100 dark:text-stone-900"
					>
						{content}
					</RadixTooltip.Content>
				</RadixTooltip.Portal>
			</RadixTooltip.Root>
		</RadixTooltip.Provider>
	);
}
