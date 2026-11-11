import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { CalendarX } from "lucide-react";
import { Button } from "./Button";
import { EmptyState } from "./EmptyState";

const meta = {
	title: "Components/EmptyState",
	component: EmptyState,
	args: { title: "Ei tulevia varauksia" },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithIconAndAction: Story = {
	args: {
		icon: CalendarX,
		children: "Kun teet varauksen, se näkyy täällä.",
		action: <Button>Uusi varaus</Button>,
	},
};
