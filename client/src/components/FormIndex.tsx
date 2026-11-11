import { useEffect, useState } from "react";
import { cn } from "#/utils/cn";

export interface FormIndexItem {
	/** Id of the `FormSection` the link jumps to */
	id: string;
	label: string;
}

export interface FormIndexProps {
	items: FormIndexItem[];
	/** Accessible name of the navigation */
	"aria-label": string;
	className?: string;
}

/**
 * Numbered table of contents for a long form. Highlights the section currently near the top of
 * the viewport (scroll-spy) and jumps to a section on click. Meant for the side column of
 * `GuidedFormLayout`.
 */
export function FormIndex({
	items,
	"aria-label": ariaLabel,
	className,
}: FormIndexProps) {
	const [active, setActive] = useState(items[0]?.id);
	const idsKey = items.map((item) => item.id).join("|");

	// biome-ignore lint/correctness/useExhaustiveDependencies: idsKey stands for the item ids
	useEffect(() => {
		if (typeof IntersectionObserver === "undefined") return;
		const visible = new Set<string>();
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) visible.add(entry.target.id);
					else visible.delete(entry.target.id);
				}
				// The first section in form order that is in the upper part of the viewport
				const current = items.find((item) => visible.has(item.id));
				if (current) setActive(current.id);
			},
			{ rootMargin: "0px 0px -60% 0px" },
		);
		for (const item of items) {
			const el = document.getElementById(item.id);
			if (el) observer.observe(el);
		}
		return () => observer.disconnect();
	}, [idsKey]);

	return (
		<nav aria-label={ariaLabel} className={className}>
			<ol className="space-y-1">
				{items.map((item, index) => {
					const isActive = item.id === active;
					return (
						<li key={item.id}>
							<a
								href={`#${item.id}`}
								aria-current={isActive ? "location" : undefined}
								onClick={(e) => {
									e.preventDefault();
									setActive(item.id);
									document
										.getElementById(item.id)
										?.scrollIntoView({ behavior: "smooth", block: "start" });
								}}
								className={cn(
									"focus-ring flex items-center gap-2 rounded-md border-l-2 px-2 py-1.5 text-sm",
									isActive
										? "border-accent bg-surface-muted font-semibold text-ink"
										: "border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
								)}
							>
								<span className="w-4 text-xs tabular-nums">{index + 1}</span>
								<span className="min-w-0 truncate">{item.label}</span>
							</a>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
