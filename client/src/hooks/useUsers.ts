import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";
import { authKeys } from "#/hooks/useAuth";

export type User = components["schemas"]["User"];
export type CreateUserPayload = components["schemas"]["CreateUser"];
export type UpdateUserPayload = components["schemas"]["UpdateUser"];
export type RegisterPayload = components["schemas"]["RegisterPayload"];

export const userKeys = {
	all: ["users"] as const,
	lists: () => [...userKeys.all, "list"] as const,
	details: () => [...userKeys.all, "detail"] as const,
	detail: (id: string) => [...userKeys.details(), id] as const,
	sessions: (id: string) => [...userKeys.detail(id), "sessions"] as const,
};

/** Lists all users (admin only); pass `enabled: false` for callers that may not be admins */
export function useUsers({ enabled = true }: { enabled?: boolean } = {}) {
	return useQuery({
		enabled,
		queryKey: userKeys.lists(),
		queryFn: async () => {
			const { data, error } = await api.GET("/users");
			if (error || !data)
				throw new Error(
					i18next.t(
						"kayttajienHakuEpaonnistui",
						"Käyttäjien hakeminen epäonnistui.",
					),
				);
			return data;
		},
		staleTime: 1000 * 60 * 5,
	});
}

export function useUser(id: string) {
	return useQuery({
		queryKey: userKeys.detail(id),
		queryFn: async () => {
			const { data, error } = await api.GET("/users/{id}", {
				params: { path: { id } },
			});
			if (error || !data)
				throw new Error(
					i18next.t("kayttajaaEiLoytynyt", "Käyttäjän tiedot ei löytynyt."),
				);
			return data;
		},
		enabled: Boolean(id),
	});
}

/** Admin endpoint to create a user directly */
export function useCreateUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: CreateUserPayload) => {
			const { data, error } = await api.POST("/users", { body: payload });
			if (error || !data)
				throw new Error(
					i18next.t(
						"kayttajanLuominenEpaonnistui",
						"Käyttäjän luominen epäonnistui.",
					),
				);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });
		},
	});
}

/** Public sign-up / registration */
export function useRegisterUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: RegisterPayload) => {
			const { data, error } = await api.POST("/auth/register", {
				body: payload,
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"rekisteroityminenEpaonnistui",
						"Rekisteröityminen epäonnistui.",
					),
				);
			return data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });
		},
	});
}

export function useUpdateUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async ({
			id,
			payload,
		}: {
			id: string;
			payload: UpdateUserPayload;
		}) => {
			const { data, error } = await api.PATCH("/users/{id}", {
				params: { path: { id } },
				body: payload,
			});
			if (error || !data)
				throw new Error(
					i18next.t(
						"kayttajanPaivitysEpaonnistui",
						"Käyttäjän päivitys epäonnistui.",
					),
				);
			return data;
		},
		onSuccess: (updatedUser) => {
			queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });
		},
	});
}

/** Updates the authenticated user's own profile (name, email, default contact info) */
export function useUpdateMe() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (payload: UpdateUserPayload) => {
			const { data, error } = await api.PATCH("/users/me", { body: payload });
			if (error || !data)
				throw new Error(
					i18next.t(
						"kayttajanPaivitysEpaonnistui",
						"Käyttäjän päivitys epäonnistui.",
					),
				);
			return data;
		},
		onSuccess: (updatedUser) => {
			queryClient.setQueryData(authKeys.me(), updatedUser);
			queryClient.setQueryData(userKeys.detail(updatedUser.id), updatedUser);
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });
		},
	});
}

export function useDeleteUser() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (id: string) => {
			const { error } = await api.DELETE("/users/{id}", {
				params: { path: { id } },
			});
			if (error)
				throw new Error(
					i18next.t(
						"kayttajanPoistoEpaonnistui",
						"Käyttäjän poisto epäonnistui.",
					),
				);
			return id;
		},
		onSuccess: (deletedId) => {
			queryClient.removeQueries({ queryKey: userKeys.detail(deletedId) });
			queryClient.invalidateQueries({ queryKey: userKeys.lists() });
		},
	});
}

export type BatchUserOperation =
	| {
			kind: "create";
			payload: CreateUserPayload;
			/** Contact info is not accepted by POST /users, so it is patched in afterwards */
			contact?: UpdateUserPayload;
	  }
	| { kind: "update"; id: string; email: string; payload: UpdateUserPayload };

function apiErrorMessage(error: unknown, fallback: string) {
	return typeof error === "object" && error !== null && "error" in error
		? String((error as { error: unknown }).error)
		: fallback;
}

/** Creates new users and/or updates existing ones; failures are collected per user. */
export function useBatchUpsertUsers() {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: async (operations: BatchUserOperation[]) => {
			const results = await Promise.allSettled(
				operations.map(async (op) => {
					if (op.kind === "update") {
						const { data, error } = await api.PATCH("/users/{id}", {
							params: { path: { id: op.id } },
							body: op.payload,
						});
						if (error || !data)
							throw new Error(
								`${op.email}: ${apiErrorMessage(
									error,
									i18next.t(
										"kayttajanPaivitysEpaonnistui",
										"Käyttäjän päivitys epäonnistui.",
									),
								)}`,
							);
						return data;
					}

					const { data, error } = await api.POST("/users", {
						body: op.payload,
					});
					if (error || !data)
						throw new Error(
							`${op.payload.email}: ${apiErrorMessage(
								error,
								i18next.t(
									"kayttajanLuominenEpaonnistui",
									"Käyttäjän luominen epäonnistui.",
								),
							)}`,
						);
					if (!op.contact) return data;

					const patched = await api.PATCH("/users/{id}", {
						params: { path: { id: data.id } },
						body: op.contact,
					});
					if (patched.error || !patched.data)
						throw new Error(
							`${op.payload.email}: ${i18next.t(
								"yhteystietojenTallennusEpaonnistui",
								"Käyttäjä luotiin, mutta yhteystietojen tallennus epäonnistui.",
							)}`,
						);
					return patched.data;
				}),
			);

			const rejected = results.filter(
				(r): r is PromiseRejectedResult => r.status === "rejected",
			);
			if (rejected.length > 0) {
				const details = rejected.map((r) => r.reason.message).join("\n");
				throw new Error(details);
			}

			return results.map((r) => (r as PromiseFulfilledResult<User>).value);
		},
		onSettled: () => {
			// Some operations may have succeeded even when others failed
			queryClient.invalidateQueries({ queryKey: userKeys.all });
		},
	});
}
