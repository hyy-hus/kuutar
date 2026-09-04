import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact, { reactCompilerPreset } from '@vitejs/plugin-react';
import babel from '@rolldown/plugin-babel';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import path from 'node:path';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';

const config = defineConfig({
    resolve: {
        tsconfigPaths: true
    },
    plugins: [
        devtools(),
        paraglideVitePlugin({
            project: './project.inlang',
            outdir: './src/paraglide',
            strategy: ['url', 'baseLocale']
        }),
        nitro({
            preset: 'static',
            routeRules: {
                '/api/**': {
                    proxy: 'http://127.0.0.1:3000/**',
                },
            },
            rollupConfig: {
                external: [/^@sentry\//]
            }
        }),
        tailwindcss(),
        tanstackStart(),
        viteReact(),
        babel({
            presets: [reactCompilerPreset()]
        })
    ],
    test: {
        projects: [{
            extends: true,
            plugins: [
                storybookTest({
                    configDir: path.join(import.meta.dirname, '.storybook')
                })
            ],
            test: {
                name: 'storybook',
                browser: {
                    enabled: true,
                    headless: true,
                    provider: playwright({}),
                    instances: [{
                        browser: 'chromium'
                    }]
                }
            }
        }]
    }
});

export default config;
