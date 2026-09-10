module.exports = {
	locales: ["fi", "en", "sv"],
	defaultNamespace: "translation",
	output: "messages/$LOCALE.json",
	input: ["src/**/*.{ts,tsx}"],
	keySeparator: false,
	namespaceSeparator: false,
	reactNamespace: false,
	lexers: {
		tsx: ["JsxLexer"],
		ts: ["JavascriptLexer"],
	},
}
