import i18nextPlugin from 'eslint-plugin-i18next'

export default [
    {
        plugins: {
            i18next: i18nextPlugin,
        },
        rules: {
            'i18next/no-literal-string': [
                'error',
                {
                    markupOnly: true, // Only flag JSX text and UI string attributes
                    ignoreAttribute: ['className', 'to', 'type', 'id', 'key', 'variant', 'size', 'align'],
                },
            ],
        },
    },
]
