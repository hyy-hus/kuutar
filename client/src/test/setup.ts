import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import i18n from "#/i18n";

// Tests assert on English text, like the Playwright tests do
await i18n.changeLanguage("en");

afterEach(() => {
	cleanup();
	try {
		sessionStorage.clear();
		localStorage.clear();
	} catch {
		// Storage may be unavailable; nothing to reset then
	}
});
