import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 639.98px)";

function subscribe(onChange: () => void) {
	const mql = window.matchMedia?.(QUERY);
	mql?.addEventListener("change", onChange);
	return () => mql?.removeEventListener("change", onChange);
}

/** True below Tailwind's `sm` breakpoint (640px); false where matchMedia is unavailable */
export function useIsMobile(): boolean {
	return useSyncExternalStore(
		subscribe,
		() => window.matchMedia?.(QUERY).matches ?? false,
		() => false,
	);
}
