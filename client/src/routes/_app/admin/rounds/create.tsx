import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { GroupChecklist } from "#/components/GroupChecklist";
import { Input } from "#/components/Input";
import { useGroups } from "#/hooks/useGroups";
import { useResources } from "#/hooks/useResorces";
import { useCreateRound } from "#/hooks/useRounds";
import { requireAdminGuard } from "#/utils/authGuard";

export const Route = createFileRoute("/_app/admin/rounds/create")({
	beforeLoad: async ({ context }) => {
		await requireAdminGuard(context);
	},
	component: CreateRoundPage,
});

function CreateRoundPage() {
	const { t } = useTranslation();
	const navigate = useNavigate();
	const createRound = useCreateRound();
	const { data: groups, isLoading: groupsLoading } = useGroups();
	const { data: resources } = useResources();
	const blockResources = resources?.filter((r) => r.blocks_only) ?? [];

	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [opensAt, setOpensAt] = useState("");
	const [closesAt, setClosesAt] = useState("");
	const [periodStart, setPeriodStart] = useState("");
	const [periodEnd, setPeriodEnd] = useState("");
	const [max, setMax] = useState(1);
	const [resourceIds, setResourceIds] = useState<string[]>([]);
	const [groupIds, setGroupIds] = useState<string[]>([]);

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		const round = await createRound.mutateAsync({
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
		await navigate({ to: "/admin/rounds/$id", params: { id: round.id } });
	};

	const canSubmit =
		name &&
		opensAt &&
		closesAt &&
		periodStart &&
		periodEnd &&
		resourceIds.length > 0 &&
		groupIds.length > 0;

	return (
		<form onSubmit={submit} className="space-y-4 max-w-xl">
			<BackLink to="/admin/rounds">
				{t("takaisinKierroksiin", "Takaisin varauskierroksiin")}
			</BackLink>
			<h1 className="text-xl font-bold">{t("uusiKierros", "Uusi kierros")}</h1>

			<div className="space-y-1">
				<label htmlFor="round-field-1" className="block text-sm font-medium">
					{t("nimi", "Nimi")}
				</label>
				<Input
					id="round-field-1"
					value={name}
					onChange={(e) => setName(e.target.value)}
					required
				/>
			</div>
			<div className="space-y-1">
				<label htmlFor="round-field-2" className="block text-sm font-medium">
					{t("kuvaus", "Kuvaus")}
				</label>
				<Input
					id="round-field-2"
					value={description}
					onChange={(e) => setDescription(e.target.value)}
				/>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<div className="space-y-1">
					<label htmlFor="round-field-3" className="block text-sm font-medium">
						{t("hakuaikaAlkaa", "Haku alkaa")}
					</label>
					<Input
						id="round-field-3"
						type="datetime-local"
						value={opensAt}
						onChange={(e) => setOpensAt(e.target.value)}
						required
					/>
				</div>
				<div className="space-y-1">
					<label htmlFor="round-field-4" className="block text-sm font-medium">
						{t("hakuaikaPttyy", "Haku päättyy")}
					</label>
					<Input
						id="round-field-4"
						type="datetime-local"
						value={closesAt}
						onChange={(e) => setClosesAt(e.target.value)}
						required
					/>
				</div>
				<div className="space-y-1">
					<label htmlFor="round-field-5" className="block text-sm font-medium">
						{t("jaksoAlkaa", "Varattava ajanjakso alkaa")}
					</label>
					<Input
						id="round-field-5"
						type="datetime-local"
						value={periodStart}
						onChange={(e) => setPeriodStart(e.target.value)}
						required
					/>
				</div>
				<div className="space-y-1">
					<label htmlFor="round-field-6" className="block text-sm font-medium">
						{t("jaksoPttyy", "Varattava ajanjakso päättyy")}
					</label>
					<Input
						id="round-field-6"
						type="datetime-local"
						value={periodEnd}
						onChange={(e) => setPeriodEnd(e.target.value)}
						required
					/>
				</div>
			</div>

			<div className="space-y-1">
				<label htmlFor="round-field-7" className="block text-sm font-medium">
					{t(
						"enintaanHakemuksiaResurssia",
						"Hakemuksia enintään per käyttäjä ja resurssi",
					)}
				</label>
				<Input
					id="round-field-7"
					type="number"
					min={1}
					max={100}
					value={max}
					onChange={(e) => setMax(Number(e.target.value))}
					required
				/>
			</div>

			<fieldset className="space-y-1">
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

			<fieldset className="space-y-1">
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

			{createRound.isError && (
				<p role="alert" className="text-sm text-red-600">
					{createRound.error.message}
				</p>
			)}
			<Button type="submit" disabled={!canSubmit || createRound.isPending}>
				{t("luoKierros", "Luo kierros")}
			</Button>
		</form>
	);
}
