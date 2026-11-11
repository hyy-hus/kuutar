import type { Meta, StoryObj } from "@storybook/tanstack-react";
import { useState } from "react";
import { LocaleTabs } from "./LocaleTabs";

const meta = {
	title: "Components/LocaleTabs",
	component: LocaleTabs,
	args: { value: "fi", onChange: () => {} },
} satisfies Meta<typeof LocaleTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithContentDots: Story = {
	render: () => {
		const [lang, setLang] = useState("fi");
		return <LocaleTabs value={lang} onChange={setLang} filled={["fi", "en"]} />;
	},
};
