import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
        exclude: ['node_modules', 'dist'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts', 'src/**/*.tsx'],
            exclude: ['src/**/*.d.ts', 'src/**/index.ts'],
        },
        setupFiles: ['./tests/setup.ts'],
        testTimeout: 10000,
    },
    resolve: {
        alias: {
            'orz': './src/index.ts',
            'orz/core': './src/core/index.ts',
            'orz/state': './src/state/index.ts',
            'orz/react': './src/react/index.ts',
        },
    },
});
