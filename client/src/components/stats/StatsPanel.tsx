import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

const BOX = "border-2 border-stone-800 dark:border-stone-700 rounded-md";

export function StatCard({
	label,
	value,
	icon: Icon,
	accent = "text-stone-500",
	hint,
}: {
	label: string;
	value: ReactNode;
	icon: LucideIcon;
	accent?: string;
	hint?: string;
}) {
	return (
		<div className={`p-4 ${BOX} bg-stone-100 dark:bg-stone-900 space-y-1`}>
			<div className={`flex items-center justify-between ${accent}`}>
				<span className="text-xs font-mono font-bold uppercase">{label}</span>
				<Icon size={16} />
			</div>
			<p className="text-2xl font-black text-stone-900 dark:text-stone-100 font-mono">
				{value}
			</p>
			{hint && <p className="text-xs font-mono text-stone-500">{hint}</p>}
		</div>
	);
}

export function Panel({
	title,
	icon: Icon,
	iconClass = "text-purple-600 dark:text-purple-400",
	children,
	className = "",
}: {
	title: string;
	icon: LucideIcon;
	iconClass?: string;
	children: ReactNode;
	className?: string;
}) {
	return (
		<section
			className={`p-5 ${BOX} bg-stone-50 dark:bg-stone-900 space-y-4 min-w-0 ${className}`}
		>
			<h2 className="font-bold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
				<Icon size={16} className={iconClass} />
				<span>{title}</span>
			</h2>
			{children}
		</section>
	);
}

export function SectionHeading({ children }: { children: ReactNode }) {
	return (
		<h2 className="text-lg font-black text-stone-900 dark:text-stone-100 tracking-tight border-b border-stone-200 dark:border-stone-800 pb-2">
			{children}
		</h2>
	);
}

export function EmptyNote({ children }: { children: ReactNode }) {
	return <p className="text-xs text-stone-500 font-mono">{children}</p>;
}
