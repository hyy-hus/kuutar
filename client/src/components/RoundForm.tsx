import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { GroupChecklist } from "#/components/GroupChecklist";
import { Input } from "#/components/Input";
import { useGroups } from "#/hooks/useGroups";
import { useResources } from "#/hooks/useResorces";
import type { CreateRoundPayload } from "#/hooks/useRounds";
import { formatDateTimeLocal } from "#/utils/date";

export type RoundFormValues = CreateRoundPayload;

interface RoundFormProps {
	defaultValues?: Partial<RoundFormValues>;
	/** Once applications have opened only the name, description and closing time can change */
	started?: boolean;
	onSubmit: (values: RoundFormValues) => Promise<void>;
	submitLabel: string;
	isSubmitting?: boolean;
	error?: string;
}

const toLocal = (iso?: string) =>
	iso ? formatDateTimeLocal(new Date(iso)) : "";

export function RoundForm({
	defaultValues,
	started = false,
	onSubmit,
	submitLabel,
	isSubmitting,
	error,
}: RoundFormProps) {
	const { t } = useTranslation();
	const { data: groups, isLoading: groupsLoading } = useGroups();
	const { data: resources } = useResources();
	const blockResources = resources?.filter((r) => r.blocks_only) ?? [];

	const [name, setName] = useState(defaultValues?.name ?? "");
	const [description, setDescription] = useState(
		defaultValues?.description ?? "",
	);
	const [opensAt, setOpensAt] = useState(
		toLocal(defaultValues?.applications_open_at),
	);
	const [closesAt, setClosesAt] = useState(
		toLocal(defaultValues?.applications_close_at),
	);
	const [periodStart, setPeriodStart] = useState(
		toLocal(defaultValues?.period_start),
	);
	const [periodEnd, setPeriodEnd] = useState(
		toLocal(defaultValues?.period_end),
	);
	const [max, setMax] = useState(defaultValues?.max_pending_per_resource ?? 1);
	const [resourceIds, setResourceIds] = useState<string[]>(
		defaultValues?.resource_ids ?? [],
	);
	const [groupIds, setGroupIds] = useState<string[]>(
		defaultValues?.group_ids ?? [],
	);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		await onSubmit({
			name,
			description: description || null,
			applications_open_at: new Date(opensAt).toISOString(),
			applications_close_at: new Date(closesAt).toISOString(),
			period_start: new Date(periodStart).toISOString(),
			period_end: new Date(periodEnd).toISOString(),
			max_pending_per_resource: max,
			resource_ids: resourceIds,
			group_ids: groupIds,
		});
	};

	const canSubmit =
		name &&
		opensAt &&
		closesAt &&
		periodStart &&
		periodEnd &&
		resourceIds.length > 0 &&
		groupIds.length > 0;

	const field = (
		id: string,
		label: string,
		value: string,
		set: (v: string) => void,
		opts?: { type?: string; locked?: boolean; required?: boolean },
	) => (
		<div className="space-y-1">
			<label htmlFor={id} className="block text-sm font-medium">
				{label}
			</label>
			<Input
				id={id}
				type={opts?.type}
				value={value}
				onChange={(e) => set(e.target.value)}
				disabled={opts?.locked}
				required={opts?.required ?? true}
			/>
		</div>
	);

	return (
		<form onSubmit={submit} className="space-y-4 max-w-xl">
			{started && (
				<p className="text-xs text-stone-500">
					{t(
						"alkanuttaKierrostaRajattu",
						"Haku on alkanut, joten vain nimeä, kuvausta ja hakuajan loppua voi muokata.",
					)}
				</p>
			)}
			{field("round-name", t("nimi", "Nimi"), name, setName)}
			{field(
				"round-description",
				t("kuvaus", "Kuvaus"),
				description,
				setDescription,
				{
					required: false,
				},
			)}

			<div className="grid grid-cols-2 gap-3">
				{field(
					"round-opens",
					t("hakuaikaAlkaa", "Haku alkaa"),
					opensAt,
					setOpensAt,
					{ type: "datetime-local", locked: started },
				)}
				{field(
					"round-closes",
					t("hakuaikaPttyy", "Haku päättyy"),
					closesAt,
					setClosesAt,
					{ type: "datetime-local" },
				)}
				{field(
					"round-period-start",
					t("jaksoAlkaa", "Varattava ajanjakso alkaa"),
					periodStart,
					setPeriodStart,
					{ type: "datetime-local", locked: started },
				)}
				{field(
					"round-period-end",
					t("jaksoPttyy", "Varattava ajanjakso päättyy"),
					periodEnd,
					setPeriodEnd,
					{ type: "datetime-local", locked: started },
				)}
			</div>

			{field(
				"round-max",
				t(
					"enintaanHakemuksiaResurssia",
					"Hakemuksia enintään per käyttäjä ja resurssi",
				),
				String(max),
				(v) => setMax(Number(v)),
				{ type: "number", locked: started },
			)}

			<fieldset className="space-y-1" disabled={started}>
				<legend className="text-sm font-medium">
					{t("kierroksenResurssit", "Resurssit (vain varausjaksolliset)")}
				</legend>
				<div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-white dark:bg-stone-950 border border-stone-200 dark:border-stone-800 rounded-md">
					{blockResources.map((r) => (
						<label key={r.id} className="flex items-center gap-2 text-xs">
							<input
								type="checkbox"
								checked={resourceIds.includes(r.id)}
								onChange={(e) =>
									setResourceIds(
										e.target.checked
											? [...resourceIds, r.id]
											: resourceIds.filter((id) => id !== r.id),
									)
								}
							/>
							{r.name}
						</label>
					))}
				</div>
			</fieldset>

			<fieldset className="space-y-1" disabled={started}>
				<legend className="text-sm font-medium">
					{t("kierroksenRyhmat", "Ryhmät, jotka voivat hakea")}
				</legend>
				<GroupChecklist
					groups={groups}
					loading={groupsLoading}
					value={groupIds}
					onChange={setGroupIds}
				/>
			</fieldset>

			{error && (
				<p role="alert" className="text-sm text-red-600">
					{error}
				</p>
			)}
			<Button type="submit" disabled={!canSubmit || isSubmitting}>
				{submitLabel}
			</Button>
		</form>
	);
}
