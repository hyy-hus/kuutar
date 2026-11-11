import { withThemeByClassName } from "@storybook/addon-themes";
import type { Preview } from "@storybook/tanstack-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { mswLoader } from "msw-storybook-addon/csf3";
import i18n from "../src/i18n";
import { resetFixtures } from "../src/test/fixtures";
import "../src/styles.css";

/** Shared by the decorator and the router context so components and loaders see one cache */
const queryClient = new QueryClient({
	defaultOptions: { queries: { retry: false, staleTime: Infinity } },
});

const preview: Preview = {
	parameters: {
		router: { context: { queryClient } },
		layout: "padded",
	},
	globalTypes: {
		locale: {
			description: "UI language",
			toolbar: {
				icon: "globe",
				items: [
					{ value: "fi", title: "Suomi" },
					{ value: "sv", title: "Svenska" },
					{ value: "en", title: "English" },
				],
				dynamicTitle: true,
			},
		},
	},
	initialGlobals: { locale: "fi" },
	loaders: [
		mswLoader(),
		async ({ globals }) => {
			// Every story starts from an empty cache and the same fixture sequence
			queryClient.clear();
			resetFixtures();
			await i18n.changeLanguage(globals.locale ?? "fi");
		},
	],
	decorators: [
		(Story) => (
			<QueryClientProvider client={queryClient}>
				<Story />
			</QueryClientProvider>
		),
		withThemeByClassName({
			themes: { light: "", dark: "dark" },
			defaultTheme: "light",
		}),
	],
};

export default preview;
