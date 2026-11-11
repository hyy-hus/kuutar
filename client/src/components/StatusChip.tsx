import { cva, type VariantProps } from "class-variance-authority";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

export const statusChipVariants = cva(
	"inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
	{
		variants: {
			variant: {
				neutral:
					"bg-status-neutral-bg border-status-neutral-line text-status-neutral-ink",
				success:
					"bg-status-success-bg border-status-success-line text-status-success-ink",
				warning:
					"bg-status-warning-bg border-status-warning-line text-status-warning-ink",
				danger:
					"bg-status-danger-bg border-status-danger-line text-status-danger-ink",
				info: "bg-status-info-bg border-status-info-line text-status-info-ink",
			},
		},
		defaultVariants: { variant: "neutral" },
	},
);

export interface StatusChipProps
	extends VariantProps<typeof statusChipVariants> {
	/** Status is never colour-only: always give the text, and an icon where the state has one */
	children: ReactNode;
	icon?: LucideIcon;
	className?: string;
}

/**
 * State label. warning = pending, success = confirmed/open, danger = cancelled/rejected,
 * neutral = past/inactive, info = informational.
 */
export function StatusChip({
	variant,
	icon: Icon,
	children,
	className,
}: StatusChipProps) {
	return (
		<span className={cn(statusChipVariants({ variant }), className)}>
			{Icon && <Icon size={12} aria-hidden="true" className="shrink-0" />}
			{children}
		</span>
	);
}
