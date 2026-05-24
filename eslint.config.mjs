import { defineConfig, globalIgnores } from 'eslint/config';
import { createRequire } from 'node:module';
import nextVitals from 'eslint-config-next/core-web-vitals.js';
import nextTs from 'eslint-config-next/typescript.js';

const require = createRequire(import.meta.url);
const localRules = require('./eslint-rules/index.js');

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'eslint-rules/**',
  ]),
  {
    plugins: { local: localRules },
    rules: {
      'local/no-cross-module-imports': 'error',
    },
  },
]);

export default eslintConfig;
