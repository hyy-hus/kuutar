import { useEffect } from "react";
import { useHealth } from "#/hooks/useHealth";

export const DEFAULT_APP_NAME = "Kuutar";

/**
 * Instance settings served by the API (`/health`), so one built client works for every
 * instance. Falls back to the default name while loading or if the API is unreachable.
 * Also keeps `document.title` in step with the name.
 */
export function useAppConfig() {
	const { data } = useHealth();
	const appName = data?.app_name?.trim() || DEFAULT_APP_NAME;

	useEffect(() => {
		document.title = appName;
	}, [appName]);

	return { appName };
}
