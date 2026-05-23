const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./no-cross-module-imports');

// Provide the framework hooks RuleTester expects when running outside a test
// runner (we invoke it via `node eslint-rules/no-cross-module-imports.test.js`).
RuleTester.afterAll = () => {};
RuleTester.describe = (_name, fn) => fn();
RuleTester.it = (_name, fn) => fn();
RuleTester.itOnly = (_name, fn) => fn();

const ruleTester = new RuleTester();

ruleTester.run('no-cross-module-imports', rule, {
  valid: [
    { code: "import x from '@/lib/shared/auth'", filename: 'modules/jobs/lib/x.ts' },
    { code: "import x from './local'", filename: 'modules/jobs/lib/x.ts' },
    {
      code: "import x from '@/modules/jobs/lib/queries'",
      filename: 'modules/jobs/routes/index.tsx',
    },
    {
      code: "import x from '@/modules/expenses/lib/public-api'",
      filename: 'modules/jobs/lib/x.ts',
    },
    { code: "import x from '@/modules/jobs/lib/public-api'", filename: 'modules/jobs/lib/x.ts' },
  ],
  invalid: [
    {
      code: "import x from '@/modules/expenses/lib/private'",
      filename: 'modules/jobs/lib/x.ts',
      errors: [{ messageId: 'crossModule' }],
    },
    {
      code: "import x from '@/modules/expenses/components/Foo'",
      filename: 'modules/jobs/routes/index.tsx',
      errors: [{ messageId: 'crossModule' }],
    },
  ],
});

console.log('no-cross-module-imports tests passed');
