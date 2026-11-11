import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { FormSection } from "./FormSection";
import { Input } from "./Input";

const meta = {
	title: "Components/FormSection",
	component: FormSection,
	args: {
		title: "Yhteystiedot",
		description: "Näkyvät varauksen hyväksyjälle.",
		children: <Input aria-label="Sähköposti" placeholder="nimi@example.test" />,
	},
} satisfies Meta<typeof FormSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
