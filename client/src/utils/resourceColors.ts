import type { CSSProperties } from "react";

/** Palette keys accepted by the server (besides custom `#rrggbb` colors); keep in sync with `RESOURCE_COLORS` there */
export const RESOURCE_COLORS = [
	"red",
	"orange",
	"amber",
	"lime",
	"emerald",
	"teal",
	"sky",
	"blue",
	"violet",
	"pink",
] as const;

export type ResourceColor = (typeof RESOURCE_COLORS)[number];

interface ResourceColorClasses {
	/** Solid fill for swatches and legend dots */
	swatch: string;
	/** Left stripe on calendar events; the dark: variant outranks the events' dark:border-stone-600 */
	stripe: string;
	/** Light background tint with hover state for calendar events */
	tint: string;
	/** Sets `--res-color` for custom colors; spread it onto every element that uses the classes */
	style?: CSSProperties;
}

/** A custom color as the server stores it: lowercase `#rrggbb` */
export function isHexColor(value?: string | null): value is string {
	return typeof value === "string" && /^#[0-9a-f]{6}$/.test(value);
}

// Custom colors are not known to Tailwind, so the classes read a CSS variable instead
function customColorClasses(hex: string): ResourceColorClasses {
	return {
		swatch: "bg-(--res-color)",
		stripe: "border-l-(color:--res-color) dark:border-l-(color:--res-color)",
		tint: "bg-[color-mix(in_oklab,var(--res-color)_16%,white)] hover:bg-[color-mix(in_oklab,var(--res-color)_28%,white)] dark:bg-[color-mix(in_oklab,var(--res-color)_22%,black)] dark:hover:bg-[color-mix(in_oklab,var(--res-color)_32%,black)]",
		style: { "--res-color": hex } as CSSProperties,
	};
}

// Full class names so Tailwind can see them
const CLASSES: Record<ResourceColor, ResourceColorClasses> = {
	red: {
		swatch: "bg-red-500",
		stripe: "border-l-red-500 dark:border-l-red-500",
		tint: "bg-red-100 hover:bg-red-200 dark:bg-red-950/60 dark:hover:bg-red-900/70",
	},
	orange: {
		swatch: "bg-orange-500",
		stripe: "border-l-orange-500 dark:border-l-orange-500",
		tint: "bg-orange-100 hover:bg-orange-200 dark:bg-orange-950/60 dark:hover:bg-orange-900/70",
	},
	amber: {
		swatch: "bg-amber-500",
		stripe: "border-l-amber-500 dark:border-l-amber-500",
		tint: "bg-amber-100 hover:bg-amber-200 dark:bg-amber-950/60 dark:hover:bg-amber-900/70",
	},
	lime: {
		swatch: "bg-lime-500",
		stripe: "border-l-lime-500 dark:border-l-lime-500",
		tint: "bg-lime-100 hover:bg-lime-200 dark:bg-lime-950/60 dark:hover:bg-lime-900/70",
	},
	emerald: {
		swatch: "bg-emerald-500",
		stripe: "border-l-emerald-500 dark:border-l-emerald-500",
		tint: "bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/70",
	},
	teal: {
		swatch: "bg-teal-500",
		stripe: "border-l-teal-500 dark:border-l-teal-500",
		tint: "bg-teal-100 hover:bg-teal-200 dark:bg-teal-950/60 dark:hover:bg-teal-900/70",
	},
	sky: {
		swatch: "bg-sky-500",
		stripe: "border-l-sky-500 dark:border-l-sky-500",
		tint: "bg-sky-100 hover:bg-sky-200 dark:bg-sky-950/60 dark:hover:bg-sky-900/70",
	},
	blue: {
		swatch: "bg-blue-500",
		stripe: "border-l-blue-500 dark:border-l-blue-500",
		tint: "bg-blue-100 hover:bg-blue-200 dark:bg-blue-950/60 dark:hover:bg-blue-900/70",
	},
	violet: {
		swatch: "bg-violet-500",
		stripe: "border-l-violet-500 dark:border-l-violet-500",
		tint: "bg-violet-100 hover:bg-violet-200 dark:bg-violet-950/60 dark:hover:bg-violet-900/70",
	},
	pink: {
		swatch: "bg-pink-500",
		stripe: "border-l-pink-500 dark:border-l-pink-500",
		tint: "bg-pink-100 hover:bg-pink-200 dark:bg-pink-950/60 dark:hover:bg-pink-900/70",
	},
};

/** The classes for a palette key or custom hex color, or undefined for no/unknown color */
export function getResourceColor(
	key?: string | null,
): ResourceColorClasses | undefined {
	if (isHexColor(key)) return customColorClasses(key);
	return key && Object.hasOwn(CLASSES, key)
		? CLASSES[key as ResourceColor]
		: undefined;
}

// Tailwind 500 shades, for chart libraries that need real color values
const HEX: Record<ResourceColor, string> = {
	red: "#ef4444",
	orange: "#f97316",
	amber: "#f59e0b",
	lime: "#84cc16",
	emerald: "#10b981",
	teal: "#14b8a6",
	sky: "#0ea5e9",
	blue: "#3b82f6",
	violet: "#8b5cf6",
	pink: "#ec4899",
};

/** Chart color for resources without a palette color */
export const DEFAULT_CHART_COLOR = "#9333ea";

/** The hex color for a palette key or custom color, or the default chart color */
export function getResourceHex(key?: string | null): string {
	if (isHexColor(key)) return key;
	return key && Object.hasOwn(HEX, key)
		? HEX[key as ResourceColor]
		: DEFAULT_CHART_COLOR;
}
