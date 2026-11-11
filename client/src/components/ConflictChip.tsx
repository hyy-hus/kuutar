import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { Popover } from "radix-ui";
import { useEffect, useRef, useState } from "react";
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
	/** Called when the list opens or closes, so the caller can highlight the clashing rows */
	onActiveChange?: (active: boolean) => void;
	className?: string;
}

/**
 * Always-visible "Ristiriita (n)" chip. Hovering it (or clicking, which keeps it open for touch)
 * lists what the reservation clashes with; each entry links to that reservation. The list stays
 * open while the pointer is over it. Escape or a click elsewhere closes it.
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
	const closeTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

	const update = (nextHover: boolean, nextPinned: boolean) => {
		setHover(nextHover);
		setPinned(nextPinned);
		onActiveChange?.(nextHover || nextPinned);
	};

	const enter = () => {
		clearTimeout(closeTimer.current);
		update(true, pinned);
	};
	// Short delay so the pointer can travel from the chip into the list
	const leave = () => {
		clearTimeout(closeTimer.current);
		closeTimer.current = setTimeout(() => update(false, pinned), 150);
	};
	useEffect(() => () => clearTimeout(closeTimer.current), []);

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
						"focus-ring cursor-pointer",
						className,
					)}
					onPointerEnter={enter}
					onPointerLeave={leave}
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
					onPointerEnter={enter}
					onPointerLeave={leave}
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
								<Link
									to="/reservations/$id"
									params={{ id: c.id }}
									className="focus-ring block min-w-0 rounded-sm hover:underline"
								>
									<span className="block truncate font-medium">{c.title}</span>
									<span className="block text-xs text-ink-muted tabular-nums">
										{c.resource ? `${c.resource} · ` : ""}
										{c.time}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}
