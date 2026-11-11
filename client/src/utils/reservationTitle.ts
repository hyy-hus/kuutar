/**
 * Imported Outlook reservations often have titles like "Outlook: Team meeting". The Outlook origin
 * is shown with a badge, so the prefix is noise. Returns the title unchanged when it is only the prefix.
 */
export function stripOutlookPrefix(title: string): string {
	const stripped = title.replace(/^\s*outlook\s*:\s*/i, "");
	return stripped.trim() === "" ? title : stripped;
}
