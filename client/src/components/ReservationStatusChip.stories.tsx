import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { ReservationStatusChip } from "./ReservationStatusChip";

const meta = {
	title: "Components/ReservationStatusChip",
	component: ReservationStatusChip,
	args: { status: "pending" },
} satisfies Meta<typeof ReservationStatusChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Pending: Story = {};
export const Confirmed: Story = { args: { status: "confirmed" } };
export const Cancelled: Story = { args: { status: "cancelled" } };
