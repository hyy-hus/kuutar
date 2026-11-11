import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { Button } from "./Button";
import { FormActions } from "./FormActions";
import { FormLayout } from "./FormLayout";
import { FormSection } from "./FormSection";
import { Input } from "./Input";
import { PageHeader } from "./PageHeader";
import { Textarea } from "./Textarea";

const meta = {
	title: "Layout/FormLayout",
	component: FormLayout,
	parameters: { layout: "fullscreen" },
	args: { children: null },
} satisfies Meta<typeof FormLayout>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Narrow: Story = {
	render: () => (
		<FormLayout>
			<PageHeader title="Uusi resurssi" />
			<FormSection title="Perustiedot" description="Nimi näkyy kaikille.">
				<div className="space-y-1">
					<label htmlFor="name" className="text-sm font-medium">
						Nimi *
					</label>
					<Input id="name" aria-required />
				</div>
				<div className="space-y-1">
					<label htmlFor="desc" className="text-sm font-medium">
						Kuvaus
					</label>
					<Textarea id="desc" />
				</div>
			</FormSection>
			<FormActions onCancel={() => {}} hint="Täytä nimi ennen tallennusta.">
				<Button>Luo resurssi</Button>
			</FormActions>
		</FormLayout>
	),
};
