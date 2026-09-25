import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

const resolve = {
    alias: {
        '@': path.resolve(__dirname, './'),
    },
}

export default defineConfig({
    plugins: [react()],
    resolve,
    test: {
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['app/actions/**', 'utils/**', 'app/lib/**'],
        },
        projects: [
            {
                plugins: [react()],
                resolve,
                test: {
                    name: 'unit',
                    environment: 'jsdom',
                    globals: true,
                    setupFiles: ['./tests/setup.ts'],
                    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
                    exclude: ['node_modules', '.next', 'tests/e2e/**', 'tests/integration/**'],
                },
            },
            {
                resolve,
                test: {
                    // Real PostgreSQL (PGlite, WASM) loaded from the live schema.
                    // Each file boots its own database, which is CPU-heavy: run
                    // them one at a time so they neither starve each other nor
                    // the jsdom suite, and give the boot a generous hook budget.
                    name: 'integration',
                    environment: 'node',
                    globals: true,
                    setupFiles: ['./tests/setup.ts'],
                    include: ['tests/integration/**/*.test.ts'],
                    fileParallelism: false,
                    hookTimeout: 120_000,
                    testTimeout: 30_000,
                },
            },
        ],
    },
})
