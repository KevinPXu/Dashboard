import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    passWithNoTests: false,
    exclude: [
      'node_modules/**',
      'tests/e2e/**',
      'tests/integration/**',
      '.next/**',
      'eslint-rules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['lib/shared/**/*.ts', 'modules/*/lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', 'lib/shared/db.ts'],
      thresholds: { lines: 80, functions: 80, statements: 80 },
    },
  },
});
