import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Button } from "./Button";
import { FormDetails } from "./FormDetails";
import { FormSection } from "./FormSection";
import { FormSummaryCard } from "./FormSummaryCard";
import { GuidedFormLayout } from "./GuidedFormLayout";
import { Input } from "./Input";
import { StickyFormActions } from "./StickyFormActions";

const sections = [
	{ id: "what", label: "Mitä ja milloin" },
	{ id: "details", label: "Tiedot" },
	{ id: "contact", label: "Yhteystiedot ja viestit" },
];

function Demo() {
	return (
		<GuidedFormLayout
			index={sections}
			indexLabel="Lomakkeen osiot"
			summary={
				<FormSummaryCard
					title="Yhteenveto"
					items={[
						{ label: "Resurssi", value: "Sauna 1" },
						{ label: "Aika", value: "12.11.2026 klo 10.00–12.00" },
						{ label: "Toisto", value: "8 kertaa" },
					]}
					footer="Varaus vahvistuu automaattisesti."
				/>
			}
		>
			{sections.map((section, i) => (
				<FormSection
					key={section.id}
					id={section.id}
					step={i + 1}
					title={section.label}
					description="Lyhyt kuvaus siitä, mihin osiota tarvitaan."
				>
					<Input aria-label={section.label} />
					<div className="h-72" />
					{i === 1 && (
						<FormDetails
							title="Lisäasetukset"
							description="Harvoin tarvittavat kentät."
						>
							<Input aria-label="Lisäkenttä" />
						</FormDetails>
					)}
				</FormSection>
			))}
			<StickyFormActions
				onCancel={() => {}}
				summary="Sauna 1 · 12.11.2026 klo 10.00–12.00 · 8 kertaa"
			>
				<Button type="submit">Tallenna</Button>
			</StickyFormActions>
		</GuidedFormLayout>
	);
}

const meta = {
	title: "Forms/GuidedFormLayout",
	component: Demo,
	parameters: { layout: "padded" },
} satisfies Meta<typeof Demo>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
