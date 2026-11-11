import fs from "node:fs";
import path from "node:path";

/** Committed showcase screenshots. Only the current version lives in the repo. */
export const SCREENSHOT_DIR = path.resolve(
	import.meta.dirname,
	"../../../docs/screenshots",
);

/** Empties a subfolder so images of removed pages or stories do not linger */
export function freshDir(name: string): string {
	const dir = path.join(SCREENSHOT_DIR, name);
	fs.rmSync(dir, { recursive: true, force: true });
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}
