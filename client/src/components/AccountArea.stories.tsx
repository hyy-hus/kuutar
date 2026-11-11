import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { AccountMenu } from "./AccountArea";
import type { Theme } from "./ThemeSwitcher";

const meta = {
	title: "Components/AccountMenu",
	component: AccountMenu,
	args: {
		user: { name: "Test User", email: "test.user@example.test" },
		theme: "light",
		onThemeChange: () => {},
		onLogout: () => {},
		onSignIn: () => {},
	},
	render: (args) => {
		const [theme, setTheme] = useState<Theme>(args.theme);
		return <AccountMenu {...args} theme={theme} onThemeChange={setTheme} />;
	},
	decorators: [
		(Story) => (
			<div className="flex h-64 w-60 items-end border-2 border-stone-800 bg-stone-100 p-2 dark:bg-stone-900">
				<div className="w-full">
					<Story />
				</div>
			</div>
		),
	],
} satisfies Meta<typeof AccountMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SignedIn: Story = {};

export const LongNameTruncated: Story = {
	args: {
		user: {
			name: "A Very Long Fictional Name That Does Not Fit",
			email: "a.very.long.fictional.address@example.test",
		},
	},
};

export const Guest: Story = { args: { user: null } };

export const Rail: Story = {
	args: { collapsed: true },
	decorators: [
		(Story) => (
			<div className="flex h-64 w-16 items-end border-2 border-stone-800 bg-stone-100 p-2 dark:bg-stone-900">
				<div className="w-full">
					<Story />
				</div>
			</div>
		),
	],
};

export const GuestRail: Story = {
	args: { user: null, collapsed: true },
	decorators: Rail.decorators,
};
