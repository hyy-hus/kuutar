import type { QueryClient } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";
import { openAuthDialog } from "#/api/client";
import { authKeys, fetchMe } from "#/hooks/useAuth";

export async function requireAuthGuard(context: {
	queryClient: QueryClient;
	user?: Awaited<ReturnType<typeof fetchMe>>;
}) {
	let user = context.user;

	if (!user) {
		try {
			user = await context.queryClient.fetchQuery({
				queryKey: authKeys.me(),
				queryFn: fetchMe,
				staleTime: 1000 * 60 * 5,
			});
		} catch {
			user = null;
		}
	}

	if (!user) {
		openAuthDialog();

		throw redirect({
			to: "/",
			replace: true,
		});
	}

	return user;
}
