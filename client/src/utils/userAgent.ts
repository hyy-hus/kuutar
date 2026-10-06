/** Short "Browser on OS" label for a User-Agent header, or null if unknown */
export function describeUserAgent(userAgent?: string | null): string | null {
	if (!userAgent) return null;

	// Order matters: Edge and Opera also say Chrome, Chrome also says Safari
	const browsers: [RegExp, string][] = [
		[/Edg(e|A|iOS)?\//, "Edge"],
		[/OPR\/|Opera/, "Opera"],
		[/Firefox\/|FxiOS\//, "Firefox"],
		[/Chrome\/|CriOS\//, "Chrome"],
		[/Safari\//, "Safari"],
	];
	// iOS UAs contain "like Mac OS X", Android UAs contain "Linux"
	const systems: [RegExp, string][] = [
		[/Android/, "Android"],
		[/iPhone|iPad|iPod/, "iOS"],
		[/Windows/, "Windows"],
		[/Mac OS X|Macintosh/, "macOS"],
		[/CrOS/, "ChromeOS"],
		[/Linux/, "Linux"],
	];

	const browser = browsers.find(([re]) => re.test(userAgent))?.[1];
	const system = systems.find(([re]) => re.test(userAgent))?.[1];

	if (browser && system) return `${browser} · ${system}`;
	return browser ?? system ?? null;
}
