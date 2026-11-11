import { cva, type VariantProps } from "class-variance-authority";
import {
	AlertTriangle,
	CheckCircle2,
	Info,
	type LucideIcon,
	XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "#/utils/cn";

const calloutVariants = cva("flex items-start gap-3 rounded-md border p-4", {
	variants: {
		variant: {
			info: "bg-status-info-bg border-status-info-line text-status-info-ink",
			warning:
				"bg-status-warning-bg border-status-warning-line text-status-warning-ink",
			danger:
				"bg-status-danger-bg border-status-danger-line text-status-danger-ink",
			success:
				"bg-status-success-bg border-status-success-line text-status-success-ink",
		},
	},
	defaultVariants: { variant: "info" },
});

const ICONS: Record<NonNullable<CalloutProps["variant"]>, LucideIcon> = {
	info: Info,
	warning: AlertTriangle,
	danger: XCircle,
	success: CheckCircle2,
};

export interface CalloutProps extends VariantProps<typeof calloutVariants> {
	/** Optional bold first line */
	title?: ReactNode;
	children?: ReactNode;
	/** Optional button or link, shown on the right (below on narrow screens) */
	action?: ReactNode;
	/** Replaces the variant's default icon */
	icon?: LucideIcon;
	className?: string;
}

/** Tinted notice box with icon. Replaces all ad-hoc coloured boxes. */
export function Callout({
	variant = "info",
	title,
	children,
	action,
	icon,
	className,
}: CalloutProps) {
	const Icon = icon ?? ICONS[variant ?? "info"];
	return (
		<div
			role={variant === "danger" ? "alert" : "note"}
			className={cn(calloutVariants({ variant }), className)}
		>
			<Icon size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
			<div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
				<div className="min-w-0 space-y-0.5 text-sm">
					{title && <p className="font-semibold">{title}</p>}
					{children && <div>{children}</div>}
				</div>
				{action && <div className="shrink-0">{action}</div>}
			</div>
		</div>
	);
}
