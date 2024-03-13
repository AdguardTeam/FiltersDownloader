import { defineConfig } from 'rollup';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import json from '@rollup/plugin-json';
import cleanup from 'rollup-plugin-cleanup';

const commonPlugins = [
    // Allow json resolution
    json(),

    // Compile TypeScript files
    typescript(),

    // Allow bundling cjs modules (unlike webpack, rollup doesn't understand cjs)
    commonjs({ sourceMap: false }),

    // Allow node_modules resolution, so you can use 'external' to control
    // which external modules to include in the bundle
    // https://github.com/rollup/rollup-plugin-node-resolve#usage
    resolve({ preferBuiltins: false }),

    cleanup({ comments: ['srcmaps'] }),
];

// Build for node
const nodeConfig = defineConfig({
    input: 'src/index.ts',
    output: [
        {
            dir: 'dist',
            format: 'cjs',
            sourcemap: false,
        },
    ],
    external: [
        'axios',
        'path',
        'fs',
        'crypto',
    ],
    plugins: commonPlugins,
});

// Build for browser
const browserConfig = defineConfig({
    input: 'src/index.browser.ts',
    output: [
        {
            dir: 'dist',
            format: 'esm',
            sourcemap: false,
        },
    ],
    external: [
        // TODO: Maybe remove axios from diff-updater?
        'axios',
        'crypto',
    ],
    plugins: commonPlugins,
});

export default [
    nodeConfig,
    browserConfig,
];
