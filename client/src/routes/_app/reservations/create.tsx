// src/routes/_app/reservations/create.tsx
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
	ReservationForm,
	type ReservationFormValues,
} from "#/components/ReservationForm";
import { useCreateReservation } from "#/hooks/useReservations";
import { requireAuthGuard } from "#/utils/authGuard";

export interface CreateReservationSearch {
	start_time?: string;
	end_time?: string;
	resource_ids?: string[];
}

// Helper to format Date for input[type="datetime-local"] (YYYY-MM-DDTHH:mm)
const formatDateTimeLocal = (date: Date) => {
	const pad = (n: number) => String(n).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

// Generates fallback start/end times spanning the current hour
const getDefaultSlot = () => {
	const start = new Date();
	start.setMinutes(0, 0, 0);

	const end = new Date(start);
	end.setHours(start.getHours() + 1);

	return {
		defaultStart: formatDateTimeLocal(start),
		defaultEnd: formatDateTimeLocal(end),
	};
};

export const Route = createFileRoute("/_app/reservations/create")({
	validateSearch: (
		search: Record<string, unknown>,
	): CreateReservationSearch => ({
		start_time:
			typeof search.start_time === "string" ? search.start_time : undefined,
		end_time: typeof search.end_time === "string" ? search.end_time : undefined,
		resource_ids: Array.isArray(search.resource_ids)
			? (search.resource_ids as string[])
			: typeof search.resource_ids === "string"
				? search.resource_ids.split(",").filter(Boolean)
				: undefined,
	}),
	beforeLoad: async ({ context }) => {
		await requireAuthGuard(context);
	},
	component: CreateReservationPage,
});

function CreateReservationPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createReservation = useCreateReservation();
	const { start_time, end_time, resource_ids } = Route.useSearch();

	// Calculate fallback times for current hour if query params aren't provided
	const { defaultStart, defaultEnd } = getDefaultSlot();

	const handleSubmit = async (values: ReservationFormValues) => {
		const created = await createReservation.mutateAsync({
			title: values.title,
			description: values.description || null,
			status: values.status,
			admin_notes: values.admin_notes || null,
			rrule: values.rrule || null,
			occurrences: values.occurrences ?? [],
		});

		navigate({ to: "/reservations/$id", params: { id: created.id } });
	};

	return (
		<div className="max-w-xl mx-auto p-2 sm:p-4 space-y-4 pb-12">
			<h1 className="text-xl font-bold text-stone-900 dark:text-stone-100">
				{t("uusiVaraus", "Uusi varaus")}
			</h1>
			<ReservationForm
				defaultValues={{
					start_time: start_time || defaultStart,
					end_time: end_time || defaultEnd,
					resource_ids,
				}}
				onSubmit={handleSubmit}
				isSubmitting={createReservation.isPending}
				submitLabel="Luo varaus"
				isCreate={true}
			/>
		</div>
	);
}
