// src/routes/sandbox.tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { CalendarX, Check, Clock, Lock, Plus, Users, X } from "lucide-react";
import { type ReactNode, useState } from "react";
import { BackLink } from "#/components/BackLink";
import { Button } from "#/components/Button";
import { Callout } from "#/components/Callout";
import { Chip, ToggleChip } from "#/components/Chip";
import { ChipSelect } from "#/components/ChipSelect";
import { DateInput } from "#/components/DateInput";
import { DateTimeInput } from "#/components/DateTimeInput";
import { DetailLayout } from "#/components/DetailLayout";
import { EmptyState } from "#/components/EmptyState";
import { EntityCard } from "#/components/EntityCard";
import { FilterBar } from "#/components/FilterBar";
import { FormActions } from "#/components/FormActions";
import { FormLayout } from "#/components/FormLayout";
import { FormSection } from "#/components/FormSection";
import { Input } from "#/components/Input";
import { LocaleTabs } from "#/components/LocaleTabs";
import { PageContainer } from "#/components/PageContainer";
import { PageHeader } from "#/components/PageHeader";
import { PeriodNavigator } from "#/components/PeriodNavigator";
import { SegmentedControl } from "#/components/SegmentedControl";
import { Select } from "#/components/Select";
import { StatusChip } from "#/components/StatusChip";
import { Textarea } from "#/components/Textarea";
import type { PeriodMonths } from "#/utils/period";

export const Route = createFileRoute("/_app/sandbox")({
	// Developer showcase: not reachable in production builds
	beforeLoad: () => {
		if (!import.meta.env.DEV) throw redirect({ to: "/", replace: true });
	},
	component: SandboxPage,
});

/* The sandbox is a developer showcase of the shared UI components, so its text is not translated. */

function Showcase({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3">
			<h2 className="text-lg font-semibold">{title}</h2>
			{children}
		</section>
	);
}

function SandboxPage() {
	const [view, setView] = useState("days");
	const [lang, setLang] = useState("fi");
	const [chips, setChips] = useState(["a"]);
	const [start, setStart] = useState(new Date(2026, 10, 1));
	const [months, setMonths] = useState<PeriodMonths>(1);

	return (
		<PageContainer className="space-y-10">
			<PageHeader
				title="Component sandbox"
				subtitle="Jaetut käyttöliittymäkomponentit (kehittäjille)"
				actions={
					<>
						<Button>
							<Plus size={16} /> Ensisijainen
						</Button>
						<Button variant="outline">Toissijainen</Button>
					</>
				}
			/>

			<Showcase title="Buttons">
				<div className="flex flex-wrap items-center gap-3">
					<Button>Default</Button>
					<Button variant="outline">Outline</Button>
					<Button variant="secondary">Secondary</Button>
					<Button variant="ghost">Ghost</Button>
					<Button variant="danger-outline">Danger outline</Button>
					<Button variant="danger">Danger (dialogs only)</Button>
					<Button size="sm">Small</Button>
					<Button size="lg">Large</Button>
					<Button disabled>Disabled</Button>
					<Button size="iconSm" variant="outline" aria-label="Lisää">
						<Plus size={16} />
					</Button>
				</div>
			</Showcase>

			<Showcase title="Chips and status chips">
				<div className="flex flex-wrap items-center gap-2">
					<Chip>Kristallisali</Chip>
					<ToggleChip selected>Valittu</ToggleChip>
					<ToggleChip>Valitsematon</ToggleChip>
					<StatusChip variant="warning" icon={Clock}>
						Odottaa
					</StatusChip>
					<StatusChip variant="success" icon={Check}>
						Vahvistettu
					</StatusChip>
					<StatusChip variant="danger" icon={X}>
						Peruttu
					</StatusChip>
					<StatusChip variant="neutral">Tulossa</StatusChip>
					<StatusChip variant="info">Päivitetty</StatusChip>
				</div>
			</Showcase>

			<Showcase title="Callouts and empty state">
				<div className="space-y-3">
					<Callout variant="info" title="Tiedoksi">
						Resurssi vahvistuu automaattisesti.
					</Callout>
					<Callout
						variant="warning"
						title="3 varausta odottaa hyväksyntää"
						action={<Button size="sm">Avaa</Button>}
					/>
					<Callout variant="danger">Tallennus epäonnistui.</Callout>
					<Callout variant="success">Tallennettu.</Callout>
					<EmptyState
						icon={CalendarX}
						title="Ei tulevia varauksia"
						action={<Button>Uusi varaus</Button>}
					>
						Kun teet varauksen, se näkyy täällä.
					</EmptyState>
				</div>
			</Showcase>

			<Showcase title="EntityCard grid">
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					<EntityCard
						to="/sandbox"
						title="Kristallisali"
						icon={Users}
						meta="Juhlatilat · 120 henkilöä"
						description="Valoisa juhlatila kampuksen keskustassa, jossa on äänentoisto, projektori ja keittiö."
						badges={
							<StatusChip variant="warning" icon={Lock}>
								Rajoitettu
							</StatusChip>
						}
					/>
					<EntityCard
						to="/sandbox"
						title="Revontulihuone"
						icon={Users}
						meta="Kokoushuoneet"
					/>
				</div>
			</Showcase>

			<Showcase title="Filter bar, segmented control, locale tabs">
				<FilterBar
					actions={
						<SegmentedControl
							aria-label="Näkymä"
							value={view}
							onChange={setView}
							options={[
								{ value: "days", label: "Päivät" },
								{ value: "month", label: "Kuukausi" },
							]}
						/>
					}
				>
					<PeriodNavigator
						start={start}
						months={months}
						onChange={(next) => {
							if (next.months) setMonths(next.months);
							if (next.start_date) {
								const [y, m, d] = next.start_date.split("-").map(Number);
								setStart(new Date(y, m - 1, d));
							}
						}}
					/>
					<Select size="sm" wrapperClassName="w-auto" aria-label="Kokoelma">
						<option>Kaikki kokoelmat</option>
						<option>Juhlatilat</option>
					</Select>
				</FilterBar>
				<LocaleTabs value={lang} onChange={setLang} filled={["fi", "en"]} />
			</Showcase>

			<Showcase title="Form controls">
				<div className="max-w-md space-y-3">
					<Input placeholder="Input" aria-label="Input" />
					<Input isError defaultValue="Virheellinen" aria-label="Virhe" />
					<Input disabled value="Pois käytöstä" aria-label="Pois käytöstä" />
					<Select aria-label="Select">
						<option>Valinta 1</option>
						<option>Valinta 2</option>
					</Select>
					<DateInput aria-label="Päivä" defaultValue="2026-11-11" />
					<DateTimeInput aria-label="Aika" defaultValue="2026-11-11T08:30" />
					<Textarea aria-label="Kuvaus" placeholder="Textarea" />
					<ChipSelect
						aria-label="Resurssit"
						value={chips}
						onChange={setChips}
						options={[
							{ value: "a", label: "Kristallisali" },
							{ value: "b", label: "Revontulihuone" },
							{ value: "c", label: "Tähtikammio" },
						]}
					/>
				</div>
			</Showcase>

			<Showcase title="FormLayout">
				<div className="rounded-md border border-dashed border-stone-400 p-4 dark:border-stone-600">
					<FormLayout>
						<FormSection title="Perustiedot" description="Nimi näkyy kaikille.">
							<Input aria-label="Nimi" placeholder="Nimi *" aria-required />
						</FormSection>
						<FormActions
							onCancel={() => {}}
							hint="Täytä nimi ennen tallennusta."
						>
							<Button>Tallenna</Button>
						</FormActions>
					</FormLayout>
				</div>
			</Showcase>

			<Showcase title="DetailLayout">
				<div className="rounded-md border border-dashed border-stone-400 p-4 dark:border-stone-600">
					<DetailLayout
						title="Kristallisali"
						back={<BackLink to="/sandbox">Takaisin</BackLink>}
						status={<StatusChip variant="success">Aktiivinen</StatusChip>}
						actions={<Button variant="outline">Muokkaa</Button>}
						dangerZone={
							<Button variant="danger-outline">Poista resurssi</Button>
						}
						technical={{
							id: "6f1c3a9e-5a2b-4a60-9d6e-0a1b2c3d4e5f",
							createdAt: "2026-09-01T09:00:00Z",
							updatedAt: "2026-10-12T14:30:00Z",
						}}
					>
						<div className="rounded-md border border-stone-300 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-900">
							Sisältö
						</div>
					</DetailLayout>
				</div>
			</Showcase>

			<Showcase title="Weight levels (L1 / L2 / L3)">
				<div className="grid gap-4 sm:grid-cols-3">
					<div className="rounded-md border-2 border-line-strong bg-surface p-4 shadow-l1">
						L1 Focus
					</div>
					<div className="rounded-md border border-line-subtle bg-surface-raised p-4">
						L2 Content
					</div>
					<div className="rounded-md bg-surface-muted p-4 text-ink-muted">
						L3 Context
					</div>
				</div>
			</Showcase>
		</PageContainer>
	);
}
