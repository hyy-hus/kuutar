import { AlertTriangle } from "lucide-react";
import { Popover } from "radix-ui";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "#/utils/cn";
import { statusChipVariants } from "./StatusChip";

export interface ConflictItem {
	id: string;
	title: string;
	resource: string;
	time: string;
}

export interface ConflictChipProps {
	conflicts: ConflictItem[];
	/** Called when the chip is hovered, focused or opened, so the caller can highlight the clashing rows */
	onActiveChange?: (active: boolean) => void;
	className?: string;
}

/**
 * Always-visible "Ristiriita (n)" chip. Hover, focus or click lists what the reservation clashes with.
 * Keyboard accessible (it is a button; Escape closes).
 */
export function ConflictChip({
	conflicts,
	onActiveChange,
	className,
}: ConflictChipProps) {
	const { t } = useTranslation();
	const [hover, setHover] = useState(false);
	const [pinned, setPinned] = useState(false);
	const open = hover || pinned;

	const update = (nextHover: boolean, nextPinned: boolean) => {
		setHover(nextHover);
		setPinned(nextPinned);
		onActiveChange?.(nextHover || nextPinned);
	};

	return (
		<Popover.Root
			open={open}
			onOpenChange={(next) => {
				// Escape / outside click
				if (!next) update(false, false);
			}}
		>
			<Popover.Trigger asChild>
				<button
					type="button"
					className={cn(
						statusChipVariants({ variant: "danger" }),
						"focus-ring cursor-pointer hover:brightness-95",
						className,
					)}
					onPointerEnter={() => update(true, pinned)}
					onPointerLeave={() => update(false, pinned)}
					onFocus={() => update(true, pinned)}
					onBlur={() => update(false, pinned)}
					onClick={(e) => {
						// Radix would toggle; we pin instead so touch users can keep it open
						e.preventDefault();
						update(hover, !pinned);
					}}
				>
					<AlertTriangle size={12} aria-hidden="true" className="shrink-0" />
					{t("ristiriitaMaara", "Ristiriita ({{count}})", {
						count: conflicts.length,
					})}
				</button>
			</Popover.Trigger>
			<Popover.Portal>
				<Popover.Content
					side="bottom"
					align="start"
					sideOffset={6}
					onOpenAutoFocus={(e) => e.preventDefault()}
					className="z-50 w-72 max-w-[calc(100vw-2rem)] rounded-md border border-line-strong bg-surface-raised p-3 text-sm text-ink focus:outline-none"
				>
					<p className="mb-2 text-xs font-semibold text-ink-muted">
						{t(
							"ristiriitaOtsikko",
							"Päällekkäinen samalla resurssilla seuraavien kanssa",
						)}
					</p>
					<ul className="space-y-2">
						{conflicts.map((c) => (
							<li key={c.id} className="min-w-0">
								<p className="truncate font-medium">{c.title}</p>
								<p className="text-xs text-ink-muted tabular-nums">
									{c.resource ? `${c.resource} · ` : ""}
									{c.time}
								</p>
							</li>
						))}
					</ul>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
