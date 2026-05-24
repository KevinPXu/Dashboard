import { defineConfig, globalIgnores } from 'eslint/config';
import { FlatCompat } from '@eslint/eslintrc';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// eslint-config-next is still legacy-config-shaped on 15.x; FlatCompat is the
// Next.js-documented bridge to consume it from flat config under ESLint 9.
const compat = new FlatCompat({
  baseDirectory: path.dirname(fileURLToPath(import.meta.url)),
});

const require = createRequire(import.meta.url);
const localRules = require('./eslint-rules/index.js');

const eslintConfig = defineConfig([
  ...compat.extends('next/core-web-vitals'),
  ...compat.extends('next/typescript'),
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', 'eslint-rules/**']),
  {
    plugins: { local: localRules },
    rules: {
      'local/no-cross-module-imports': 'error',
    },
  },
]);

export default eslintConfig;
