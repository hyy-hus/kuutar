import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import i18next from "i18next";
import { api } from "#/api/client";
import type { components } from "#/api/schema";
import type { LocalizedRichText } from "#/utils/richText";

export type EmailTemplate = components["schemas"]["EmailTemplate"];
export type EmailTemplateKey = components["schemas"]["EmailTemplateKey"];
export type EmailPreview = components["schemas"]["EmailPreview"];

/** Subject and body per language; bodies are Tiptap documents */
export interface EmailTemplateDraft {
	subject: Record<string, string>;
	body: LocalizedRichText;
}

/** Unsaved edits to render over the stored template */
export interface EmailTemplatePreviewRequest {
	language: string;
	subject?: Record<string, string>;
	body?: LocalizedRichText;
}

// The generated schema types Tiptap documents as `Record<string, never>`
type UpdateBody = components["schemas"]["UpdateEmailTemplate"];
type PreviewBody = components["schemas"]["PreviewEmailTemplate"];
export const emailTemplateKeys = {
	all: ["email-templates"] as const,
	list: () => [...emailTemplateKeys.all, "list"] as const,
};

export function useEmailTemplates() {
	return useQuery({
		queryKey: emailTemplateKeys.list(),
		queryFn: async () => {
			const { data, error } = await api.GET("/email-templates");
			if (error || !data) {
				throw new Error(
					i18next.t(
						"sahkopostipohjienHakuEpaonnistui",
						"Sähköpostipohjien hakeminen epäonnistui.",
					),
				);
			}
			return data;
		},
	});
}

/** Replaces one template in the cached list so the other tabs stay untouched */
function useCacheTemplate() {
	const queryClient = useQueryClient();
	return (updated: EmailTemplate) => {
		queryClient.setQueryData<EmailTemplate[]>(
			emailTemplateKeys.list(),
			(templates) =>
				templates?.map((template) =>
					template.key === updated.key ? updated : template,
				),
		);
	};
}

export function useSaveEmailTemplate() {
	const cacheTemplate = useCacheTemplate();

	return useMutation({
		mutationFn: async ({
			key,
			payload,
		}: {
			key: EmailTemplateKey;
			payload: EmailTemplateDraft;
		}) => {
			const { data, error } = await api.PUT("/email-templates/{key}", {
				params: { path: { key } },
				body: payload as UpdateBody,
			});
			if (error || !data) {
				throw new Error(
					i18next.t(
						"sahkopostipohjanTallennusEpaonnistui",
						"Sähköpostipohjan tallentaminen epäonnistui.",
					),
				);
			}
			return data;
		},
		onSuccess: cacheTemplate,
	});
}

/** Removes the saved version so the built-in default applies again */
export function useResetEmailTemplate() {
	const cacheTemplate = useCacheTemplate();

	return useMutation({
		mutationFn: async (key: EmailTemplateKey) => {
			const { data, error } = await api.DELETE("/email-templates/{key}", {
				params: { path: { key } },
			});
			if (error || !data) {
				throw new Error(
					i18next.t(
						"sahkopostipohjanPalautusEpaonnistui",
						"Sähköpostipohjan palauttaminen epäonnistui.",
					),
				);
			}
			return data;
		},
		onSuccess: cacheTemplate,
	});
}

/** Renders unsaved edits with sample data, without storing anything */
export function useEmailTemplatePreview() {
	return useMutation({
		mutationFn: async ({
			key,
			payload,
		}: {
			key: EmailTemplateKey;
			payload: EmailTemplatePreviewRequest;
		}) => {
			const { data, error } = await api.POST("/email-templates/{key}/preview", {
				params: { path: { key } },
				body: payload as PreviewBody,
			});
			if (error || !data) {
				throw new Error(
					i18next.t(
						"esikatseluEpaonnistui",
						"Esikatselun luominen epäonnistui.",
					),
				);
			}
			return data;
		},
	});
}

/** Sends the (possibly unsaved) template with sample data to the calling admin */
export function useSendTestEmail() {
	return useMutation({
		mutationFn: async ({
			key,
			payload,
		}: {
			key: EmailTemplateKey;
			payload: EmailTemplatePreviewRequest;
		}) => {
			const { error } = await api.POST("/email-templates/{key}/send-test", {
				params: { path: { key } },
				body: payload as PreviewBody,
			});
			if (error) {
				throw new Error(
					i18next.t(
						"testiviestinLahetysEpaonnistui",
						"Testiviestin lähettäminen epäonnistui.",
					),
				);
			}
		},
	});
}
