import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { ChipSelect } from "#/components/ChipSelect";
import { DateTimeInput } from "#/components/DateTimeInput";
import { FormActions } from "#/components/FormActions";
import { FormSection } from "#/components/FormSection";
import { GroupChecklist } from "#/components/GroupChecklist";
import { Input } from "#/components/Input";
import { Textarea } from "#/components/Textarea";
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
	onCancel?: () => void;
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
	onCancel,
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

	const label = (id: string, text: string, required = true) => (
		<label htmlFor={id} className="block text-sm font-medium">
			{text}
			{required && <span aria-hidden="true"> *</span>}
		</label>
	);

	return (
		<form onSubmit={submit} className="space-y-6">
			{started && (
				<Callout variant="info">
					{t(
						"alkanuttaKierrostaRajattu",
						"Haku on alkanut, joten vain nimeä, kuvausta ja hakuajan loppua voi muokata.",
					)}
				</Callout>
			)}

			<FormSection title={t("kierroksenPerustiedot", "Perustiedot")}>
				<div className="space-y-1">
					{label("round-name", t("nimi", "Nimi"))}
					<Input
						id="round-name"
						value={name}
						onChange={(e) => setName(e.target.value)}
						required
						aria-required="true"
					/>
				</div>
				<div className="space-y-1">
					{label("round-description", t("kuvaus", "Kuvaus"), false)}
					<Textarea
						id="round-description"
						rows={3}
						value={description}
						onChange={(e) => setDescription(e.target.value)}
					/>
				</div>
			</FormSection>

			<FormSection
				title={t("kierroksenAjoitus", "Ajoitus")}
				description={t(
					"kierroksenAjoitusKuvaus",
					"Hakuaika on aika, jolloin hakemuksia voi jättää. Varattava ajanjakso on aika, jolle haetut varaukset sijoittuvat.",
				)}
			>
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
					<div className="space-y-1">
						{label("round-opens", t("hakuaikaAlkaa", "Haku alkaa"))}
						<DateTimeInput
							id="round-opens"
							value={opensAt}
							onChange={(e) => setOpensAt(e.target.value)}
							disabled={started}
							required
							aria-required="true"
						/>
					</div>
					<div className="space-y-1">
						{label("round-closes", t("hakuaikaPttyy", "Haku päättyy"))}
						<DateTimeInput
							id="round-closes"
							value={closesAt}
							onChange={(e) => setClosesAt(e.target.value)}
							required
							aria-required="true"
						/>
					</div>
					<div className="space-y-1">
						{label(
							"round-period-start",
							t("jaksoAlkaa", "Varattava ajanjakso alkaa"),
						)}
						<DateTimeInput
							id="round-period-start"
							value={periodStart}
							onChange={(e) => setPeriodStart(e.target.value)}
							disabled={started}
							required
							aria-required="true"
						/>
					</div>
					<div className="space-y-1">
						{label(
							"round-period-end",
							t("jaksoPttyy", "Varattava ajanjakso päättyy"),
						)}
						<DateTimeInput
							id="round-period-end"
							value={periodEnd}
							onChange={(e) => setPeriodEnd(e.target.value)}
							disabled={started}
							required
							aria-required="true"
						/>
					</div>
				</div>
				<div className="max-w-xs space-y-1">
					{label(
						"round-max",
						t(
							"enintaanHakemuksiaResurssia",
							"Hakemuksia enintään per käyttäjä ja resurssi",
						),
					)}
					<Input
						id="round-max"
						type="number"
						min={1}
						value={String(max)}
						onChange={(e) => setMax(Number(e.target.value))}
						disabled={started}
						required
						aria-required="true"
					/>
				</div>
			</FormSection>

			<FormSection title={t("kierroksenKohderyhma", "Resurssit ja hakijat")}>
				<fieldset className="space-y-2" disabled={started}>
					<legend className="text-sm font-medium">
						{t("kierroksenResurssit", "Resurssit (vain varausjaksolliset)")}
						<span aria-hidden="true"> *</span>
					</legend>
					<ChipSelect
						aria-label={t(
							"kierroksenResurssit",
							"Resurssit (vain varausjaksolliset)",
						)}
						options={blockResources.map((r) => ({
							value: r.id,
							label: r.name,
						}))}
						value={resourceIds}
						onChange={setResourceIds}
					/>
				</fieldset>

				<fieldset className="space-y-2" disabled={started}>
					<legend className="text-sm font-medium">
						{t("kierroksenRyhmat", "Ryhmät, jotka voivat hakea")}
						<span aria-hidden="true"> *</span>
					</legend>
					<GroupChecklist
						groups={groups}
						loading={groupsLoading}
						value={groupIds}
						onChange={setGroupIds}
					/>
				</fieldset>
			</FormSection>

			{error && <Callout variant="danger">{error}</Callout>}
			<FormActions
				onCancel={onCancel}
				hint={
					!canSubmit
						? t(
								"kierrosTayta",
								"Täytä kaikki pakolliset kentät ja valitse vähintään yksi resurssi ja ryhmä.",
							)
						: undefined
				}
			>
				<Button type="submit" disabled={!canSubmit || isSubmitting}>
					{submitLabel}
				</Button>
			</FormActions>
		</form>
	);
}
