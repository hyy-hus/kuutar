import { RouterProvider } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "#/hooks/useAuth";
import { getContext } from "#/integrations/tanstack-query/root-provider";
import { getRouter } from "#/router";

const router = getRouter();

export function AppRouterProvider() {
	const { t } = useTranslation();
	const auth = useAuth();
	const { queryClient } = getContext();

	// Show a global loading spinner while initial auth status resolves
	if (auth.isLoading) {
		return (
			<div className="flex h-screen items-center justify-center bg-stone-50 dark:bg-stone-950">
				<span className="text-sm font-medium text-stone-500">
					{t("ladataan", "Ladataan...")}
				</span>
			</div>
		);
	}

	return (
		<RouterProvider
			router={router}
			context={{
				queryClient,
				auth: {
					user: auth.user,
					isAuthenticated: auth.isAuthenticated,
					isLoading: auth.isLoading,
					isAdmin: auth.user?.role === "admin",
				},
			}}
		/>
	);
}
