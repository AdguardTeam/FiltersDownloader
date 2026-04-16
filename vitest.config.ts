import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['__tests__/**/*.test.ts'],
        exclude: ['__tests__/server/**'],
    },
});
