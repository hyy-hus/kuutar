import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { type Theme, ThemeSwitcher } from "./ThemeSwitcher";

const meta = {
	title: "Components/ThemeSwitcher",
	component: ThemeSwitcher,
	args: { value: "light", onChange: () => {} },
} satisfies Meta<typeof ThemeSwitcher>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
	render: () => {
		const [theme, setTheme] = useState<Theme>("light");
		return <ThemeSwitcher value={theme} onChange={setTheme} />;
	},
};

export const FullWidth: Story = {
	args: { value: "dark", fullWidth: true },
	decorators: [
		(Story) => (
			<div className="w-56">
				<Story />
			</div>
		),
	],
};
