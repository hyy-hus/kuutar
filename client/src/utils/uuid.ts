export function readable_uuid(id?: string | null): string {
	if (!id) return "";
	return id.slice(0, 8);
}
