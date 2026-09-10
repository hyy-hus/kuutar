// i18next.config.ts
export default {
	locales: ["fi", "en", "sv"],
	defaultLocale: "fi",
	extract: {
		input: ["src/**/*.{ts,tsx}"],
		output: "messages/{{language}}.json",
		keySeparator: false,
		namespaceSeparator: false,
		// Exclude non-UI props from string extraction
		ignoreAttributes: [
			"className",
			"id",
			"type",
			"style",
			"variant",
			"size",
			"align",
			"name",
			"path",
			"to",
			"href"
		],
	},
}
