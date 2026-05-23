# Modular Personal Dashboard — Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the dashboard platform — a single Next.js 15 app on Vercel that hosts pluggable modules, with strict isolation, shared Postgres, single-user auth, share links, and a TDD discipline. After this plan, the platform can host module implementations (Job Tracker etc. follow as separate plans).

**Architecture:** One Next.js app. A thin platform shell (auth, DB, share links, widget grid, module loader) provides extension points consumed by modules under `modules/<id>/`. Each module owns a Postgres schema, declares itself via `module.config.ts`, and is discovered at build time. Strict cross-module isolation enforced via ESLint + module-loader validation.

**Tech Stack:** Next.js 15 (App Router), TypeScript strict, Neon Postgres, Drizzle ORM, Tailwind + shadcn/ui + Radix + Lucide, react-grid-layout, Vitest, Playwright, pnpm, Vercel (hosting + Cron), GitHub Actions CI.

**Companion docs:**
- Design spec: `docs/superpowers/specs/2026-05-21-modular-dashboard-platform-design.md`
- Living principles: `CLAUDE.md` at repo root

---

## Phase Map

1. **Foundation** — repo bootstrap, tooling, local DB
2. **Platform DB & types** — Drizzle setup, platform schema, ModuleConfig type
3. **Module loader** — filesystem discovery + manifest validation
4. **Auth & sessions** — password login, session cookie, getSession/requireOwner, middleware
5. **Shell UI** — layout, sidebar, login page, admin skeleton
6. **Platform utilities** — logger, withErrorHandler, error boundaries
7. **Share links** — sign/verify/revoke, /share/[token] route, admin UI
8. **Home widget grid** — react-grid-layout, widget persistence, widget rendering
9. **Cron aggregation** — build-step that writes vercel.json from module manifests
10. **Module scaffolding** — `_template/` and `pnpm new-module` CLI
11. **End-to-end smoke module** — trivial `modules/_smoke/` exercising every extension point
12. **CI & deploy** — GitHub Actions, Vercel config, env conventions

---

## Conventions used in this plan

- File paths are repo-relative from `/home/kevin/Personal_Dashboard/Dashboard/`.
- Test commands assume `pnpm` and that scripts are wired in `package.json` (Task 1 sets these up).
- TDD discipline: write the failing test, run it red, implement, run green, commit. Each phase starts by writing tests for the unit and only then writes the implementation.
- Commits use Conventional Commits prefixes (`feat:`, `chore:`, `test:`, `fix:`).
- Coverage gate (80% on `lib/`) applies to modules' `lib/`. Platform `lib/shared/` is also tested but not strictly gated; aim to keep it above 80% in practice.

## Checkpoint discipline

This plan is structured around **mandatory human-verified checkpoints** at the end of every phase. Per `CLAUDE.md` §1.5:

- **Auto mode does NOT skip checkpoints.** Even if the harness biases toward continuing, Claude must stop at every `## Checkpoint N` block, surface its testing suite to Kevin, and wait for explicit confirmation before starting the next phase.
- **The testing suite is the gate.** A checkpoint is only "passed" when every command in its testing suite produces the expected output. Failures must be fixed *within the current phase* before advancing.
- **Manual verification is part of the suite.** Where a checkpoint says "open browser and check X," that step is as load-bearing as the automated commands. Do not advance on automated-only passes when manual steps remain.

---

# Phase 1: Foundation

Initial repo scaffold: Next.js 15 + TypeScript strict + Tailwind + shadcn/ui + ESLint + Prettier + Vitest + Playwright + pnpm + docker-compose Postgres.

## Task 1.1: Initialize Next.js app with pnpm

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `next-env.d.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `postcss.config.mjs`, `.gitignore` (already exists — extend)

- [ ] **Step 1: Run `pnpm dlx create-next-app@latest .` with non-interactive flags**

Run from `/home/kevin/Personal_Dashboard/Dashboard/`:

```bash
pnpm dlx create-next-app@latest . \
  --ts --tailwind --eslint --app --src-dir=false \
  --import-alias "@/*" --use-pnpm --no-turbo --skip-install
```

If prompted about non-empty directory, accept overwrite for the scaffold files only. The existing `CLAUDE.md`, `README.md`, `docs/`, and `.gitignore` must be preserved (move them aside if needed and restore after).

- [ ] **Step 2: Install dependencies**

```bash
pnpm install
```

Expected: clean install, no errors.

- [ ] **Step 3: Set TypeScript strict + paths**

Edit `tsconfig.json` `compilerOptions` to ensure these are set (merge with what create-next-app generated):

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "moduleResolution": "Bundler",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] **Step 4: Verify dev server boots**

```bash
pnpm dev
```

Expected: Next.js dev server starts on port 3000 without errors. Stop with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 app with TypeScript strict + Tailwind"
```

## Task 1.2: Install shadcn/ui

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/` (initial components)

- [ ] **Step 1: Initialize shadcn**

```bash
pnpm dlx shadcn@latest init --yes --defaults --base-color=slate
```

- [ ] **Step 2: Add initial component set**

```bash
pnpm dlx shadcn@latest add button input label card dialog dropdown-menu sheet table form sonner
```

- [ ] **Step 3: Install lucide-react explicitly**

```bash
pnpm add lucide-react
```

- [ ] **Step 4: Verify build still works**

```bash
pnpm build
```

Expected: build completes cleanly.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: install shadcn/ui with initial component set"
```

## Task 1.3: Configure Prettier and extend ESLint

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`
- Modify: `eslint.config.mjs` (or `.eslintrc.json` depending on which create-next-app emitted)

- [ ] **Step 1: Install Prettier and ESLint companions**

```bash
pnpm add -D prettier eslint-config-prettier eslint-plugin-prettier @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

- [ ] **Step 2: Write `.prettierrc.json`**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Then:

```bash
pnpm add -D prettier-plugin-tailwindcss
```

- [ ] **Step 3: Write `.prettierignore`**

```
node_modules
.next
.turbo
dist
out
coverage
playwright-report
test-results
*.log
pnpm-lock.yaml
```

- [ ] **Step 4: Add npm scripts**

Edit `package.json` `scripts`:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 5: Run lint + format + typecheck to verify**

```bash
pnpm format
pnpm lint
pnpm typecheck
```

Expected: all three commands exit 0.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure Prettier and TypeScript scripts"
```

## Task 1.4: Set up Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (add test scripts)

- [ ] **Step 1: Install Vitest**

```bash
pnpm add -D vitest @vitest/coverage-v8 @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Write `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      include: ['lib/shared/**/*.ts', 'modules/*/lib/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/types.ts'],
      thresholds: {
        // Per-module thresholds enforced by a separate CI step; here we set
        // a global floor so dev gets early signal.
        lines: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

- [ ] **Step 3: Write `vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add test scripts to `package.json`**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest --run",
    "test:coverage": "vitest --run --coverage",
    "test:integration": "vitest --run --dir tests/integration"
  }
}
```

- [ ] **Step 5: Write a smoke test to verify wiring**

Create `lib/shared/smoke.test.ts`:

```ts
import { describe, it, expect } from 'vitest';

describe('vitest smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run it**

```bash
pnpm test:run
```

Expected: 1 test passes.

- [ ] **Step 7: Delete the smoke test**

```bash
rm lib/shared/smoke.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: configure Vitest + React Testing Library"
```

## Task 1.5: Set up Playwright

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/.gitkeep`

- [ ] **Step 1: Install Playwright**

```bash
pnpm add -D @playwright/test
pnpm exec playwright install --with-deps chromium
```

- [ ] **Step 2: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'pnpm dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
```

- [ ] **Step 3: Add E2E scripts**

In `package.json`:

```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

- [ ] **Step 4: Create empty e2e dir**

```bash
mkdir -p tests/e2e && touch tests/e2e/.gitkeep
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: configure Playwright E2E framework"
```

## Task 1.6: Local Postgres via docker-compose

**Files:**
- Create: `docker-compose.yml`, `.env.example`, `.env.local` (gitignored — local only)

- [ ] **Step 1: Write `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: dashboard-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: dashboard
      POSTGRES_PASSWORD: dashboard
      POSTGRES_DB: dashboard
    ports:
      - "5432:5432"
    volumes:
      - dashboard-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U dashboard"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  dashboard-postgres-data:
```

- [ ] **Step 2: Write `.env.example`**

```
# Required
DATABASE_URL=postgres://dashboard:dashboard@localhost:5432/dashboard
DASHBOARD_PASSWORD=changeme
SHARE_LINK_SIGNING_KEY=replace-with-32-byte-random-hex
SESSION_COOKIE_SECRET=replace-with-32-byte-random-hex

# Optional (per-module)
# JOB_TRACKER_OPENAI_KEY=
```

- [ ] **Step 3: Create `.env.local` from example**

```bash
cp .env.example .env.local
# Edit .env.local with real local values
```

Replace `replace-with-32-byte-random-hex` values with 64-char hex strings (use `openssl rand -hex 32`).

- [ ] **Step 4: Add DB scripts to `package.json`**

```json
{
  "scripts": {
    "db:up": "docker compose up -d postgres",
    "db:down": "docker compose down",
    "db:logs": "docker compose logs -f postgres"
  }
}
```

- [ ] **Step 5: Verify Postgres boots**

```bash
pnpm db:up
docker compose ps
```

Expected: `dashboard-postgres` healthy.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example package.json
git commit -m "chore: add docker-compose Postgres for local development"
```

---

## Checkpoint 1 — Foundation tools installed and working

**Stop here. Do not start Phase 2 until every item below passes.**

> **Note:** This plan originally specified a local docker-compose Postgres for development. We switched to using a Neon branch directly for dev (cleaner, identical to prod, no local infra). `docker-compose.yml` and the `db:up`/`db:down`/`db:logs` scripts have been removed. CI still uses a Postgres service container (or Neon ephemeral branches) — see Phase 12.

**Testing suite:**

```bash
# 1. Toolchain sanity
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck

# 2. Build pipeline
pnpm build

# 3. Test runners are wired
pnpm test:run                 # zero or one trivial test — should exit 0
pnpm exec playwright --version

# 4. Neon connectivity (after .env.local is populated)
node -e "(async()=>{const p=(await import('postgres')).default;const sql=p(process.env.DATABASE_URL);const r=await sql\`SELECT 1 as ok\`;console.log(r);await sql.end();})()"
# Expected: prints [ { ok: 1 } ]
# (postgres-js will be a dep after Phase 2; for now this command may fail until it's installed)
```

**Manual verification:**

1. **Neon project created** at https://console.neon.tech with at least two branches: `main` (production) and `dev` (local development).
2. **`.env.local` populated** with the `dev` branch's connection string as `DATABASE_URL`. Also confirm `DASHBOARD_PASSWORD`, `SHARE_LINK_SIGNING_KEY`, and `SESSION_COOKIE_SECRET` are real non-placeholder values.
3. Run `pnpm dev`. Open http://localhost:3000. The default Next.js page (or our empty page) renders without console errors. Stop with Ctrl-C.

**What this verifies:** the toolchain (Next.js, TypeScript strict, Tailwind, shadcn, ESLint, Prettier, Vitest, Playwright, pnpm scripts) is installed and functional, and a Neon Postgres branch is reachable from local dev. No platform logic exists yet — that's the next phase.

---

# Phase 2: Platform DB & types

Drizzle setup with platform schema first (share_links, widget_layouts, settings, sessions). Module schemas come later via the module-loader pattern.

## Task 2.1: Install and configure Drizzle

**Files:**
- Create: `drizzle.config.ts`, `lib/shared/db.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Drizzle**

```bash
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit
```

- [ ] **Step 2: Write `drizzle.config.ts`**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./platform/db/schema.ts', './modules/*/db/schema.ts'],
  out: './platform/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
```

Note: a single `out` directory is used for now; per-module migration directories are introduced later via a custom runner if needed. For the platform itself we keep all generated SQL together and rely on schema namespacing for isolation.

- [ ] **Step 3: Write `lib/shared/db.ts`**

```ts
import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 30,
  prepare: false,
});

export const db = drizzle(client);
export type DB = typeof db;
```

- [ ] **Step 4: Add Drizzle scripts**

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio"
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: configure Drizzle ORM with postgres-js driver"
```

## Task 2.2: TDD `lib/shared/types.ts` — ModuleConfig type & validation primitives

**Files:**
- Create: `lib/shared/types.ts`, `lib/shared/types.test.ts`

The `ModuleConfig` type is structural — there's nothing to test at the type level alone. We instead write a Zod schema that validates a ModuleConfig at runtime, and TDD that.

- [ ] **Step 1: Install Zod**

```bash
pnpm add zod
```

- [ ] **Step 2: Write the failing test**

Create `lib/shared/types.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { ModuleConfigSchema } from './types';

const validConfig = {
  id: 'job-tracker',
  name: 'Job Tracker',
  version: '0.1.0',
  description: 'Track jobs.',
  enabled: true,
  icon: 'Briefcase',
  nav: { label: 'Jobs', order: 10 },
  routes: [
    { path: '/', component: 'routes/index', shareable: false },
    { path: '/pipeline', component: 'routes/pipeline', shareable: { mode: 'read-only' as const } },
  ],
  api: [{ path: '/applications', methods: ['GET', 'POST'] as const }],
  widgets: [
    {
      id: 'upcoming',
      name: 'Upcoming',
      defaultSize: { w: 4, h: 2 },
      minSize: { w: 3, h: 2 },
      component: 'widgets/Upcoming',
    },
  ],
  db: { schema: 'job_tracker' },
  cron: [{ schedule: '0 9 * * 1', handler: '/api/job-tracker/cron/digest' }],
  env: { required: [], optional: ['JOB_TRACKER_OPENAI_KEY'] },
};

describe('ModuleConfigSchema', () => {
  it('accepts a valid full config', () => {
    expect(ModuleConfigSchema.parse(validConfig)).toEqual(validConfig);
  });

  it('rejects non-kebab-case id', () => {
    expect(() =>
      ModuleConfigSchema.parse({ ...validConfig, id: 'JobTracker' }),
    ).toThrow(/kebab-case/);
  });

  it('rejects db.schema that does not match id', () => {
    expect(() =>
      ModuleConfigSchema.parse({ ...validConfig, db: { schema: 'wrong' } }),
    ).toThrow(/db\.schema/);
  });

  it('rejects invalid cron expression', () => {
    expect(() =>
      ModuleConfigSchema.parse({
        ...validConfig,
        cron: [{ schedule: 'not-a-cron', handler: '/api/x' }],
      }),
    ).toThrow(/cron/);
  });

  it('allows empty arrays for routes/api/widgets/cron', () => {
    const minimal = {
      ...validConfig,
      routes: [],
      api: [],
      widgets: [],
      cron: [],
    };
    expect(() => ModuleConfigSchema.parse(minimal)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run the test (expect FAIL)**

```bash
pnpm test:run lib/shared/types.test.ts
```

Expected: fails because `./types` doesn't exist yet.

- [ ] **Step 4: Implement `lib/shared/types.ts`**

```ts
import { z } from 'zod';

const KebabCase = z
  .string()
  .regex(/^[a-z][a-z0-9-]*[a-z0-9]$/, 'must be kebab-case (lowercase letters, digits, hyphens)');

const CronExpression = z.string().refine(
  (val) => {
    // Minimal cron validator: 5 space-separated fields, each matching cron field syntax.
    const fields = val.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    const fieldPattern = /^(\*|(\*\/\d+)|(\d+(-\d+)?(\/\d+)?)(,(\d+(-\d+)?(\/\d+)?))*)$/;
    return fields.every((f) => fieldPattern.test(f));
  },
  { message: 'cron schedule must be a valid 5-field expression' },
);

const RouteSchema = z.object({
  path: z.string().startsWith('/'),
  component: z.string().min(1),
  shareable: z.union([
    z.literal(false),
    z.object({ mode: z.literal('read-only') }),
  ]),
});

const ApiSchema = z.object({
  path: z.string().startsWith('/'),
  methods: z.array(z.enum(['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])).nonempty(),
});

const WidgetSchema = z.object({
  id: KebabCase,
  name: z.string().min(1),
  defaultSize: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  minSize: z.object({ w: z.number().int().positive(), h: z.number().int().positive() }),
  component: z.string().min(1),
});

const CronEntrySchema = z.object({
  schedule: CronExpression,
  handler: z.string().startsWith('/'),
});

export const ModuleConfigSchema = z
  .object({
    id: KebabCase,
    name: z.string().min(1),
    version: z.string().regex(/^\d+\.\d+\.\d+/),
    description: z.string().min(1),
    enabled: z.boolean(),
    icon: z.string().min(1),
    nav: z.object({ label: z.string().min(1), order: z.number().int() }),
    routes: z.array(RouteSchema),
    api: z.array(ApiSchema),
    widgets: z.array(WidgetSchema),
    db: z.object({ schema: z.string().regex(/^[a-z][a-z0-9_]*$/, 'snake_case') }),
    cron: z.array(CronEntrySchema),
    env: z.object({
      required: z.array(z.string()),
      optional: z.array(z.string()),
    }),
  })
  .superRefine((val, ctx) => {
    const expectedSchema = val.id.replace(/-/g, '_');
    if (val.db.schema !== expectedSchema) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['db', 'schema'],
        message: `db.schema must equal id with hyphens replaced by underscores (expected "${expectedSchema}")`,
      });
    }
  });

export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;
```

- [ ] **Step 5: Run tests (expect PASS)**

```bash
pnpm test:run lib/shared/types.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/shared/types.ts lib/shared/types.test.ts
git commit -m "feat: add ModuleConfig type with Zod validation"
```

## Task 2.3: Platform Drizzle schema

**Files:**
- Create: `platform/db/schema.ts`

The platform owns three tables in the `platform` Postgres schema: `share_links`, `widget_layouts`, `settings`. We'll add a `sessions` table for password-auth sessions in Phase 4.

- [ ] **Step 1: Write `platform/db/schema.ts`**

```ts
import {
  pgSchema,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
} from 'drizzle-orm/pg-core';

export const platform = pgSchema('platform');

export const shareLinks = platform.table(
  'share_links',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    moduleId: text('module_id').notNull(),
    route: text('route').notNull(),
    label: text('label'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (table) => ({
    moduleRouteIdx: index('share_links_module_route_idx').on(table.moduleId, table.route),
  }),
);

export const widgetLayouts = platform.table('widget_layouts', {
  id: text('id').primaryKey().default('singleton'),
  layout: jsonb('layout').notNull().$type<WidgetLayoutEntry[]>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const settings = platform.table('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type WidgetLayoutEntry = {
  moduleId: string;
  widgetId: string;
  enabled: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
};
```

- [ ] **Step 2: Generate migration**

```bash
pnpm db:generate
```

(DATABASE_URL is read from `.env.local`, which points to the Neon dev branch — no local Postgres to start.)

Expected: a SQL file appears under `platform/db/migrations/` creating the `platform` schema and the three tables.

- [ ] **Step 3: Run migration against local DB**

```bash
pnpm db:migrate
```

Expected: migration applies cleanly.

- [ ] **Step 4: Verify schema in DB**

```bash
docker exec -i dashboard-postgres psql -U dashboard -d dashboard -c "\dt platform.*"
```

Expected: three tables listed (share_links, widget_layouts, settings).

- [ ] **Step 5: Commit**

```bash
git add platform/db/schema.ts platform/db/migrations/
git commit -m "feat: add platform Postgres schema (share_links, widget_layouts, settings)"
```

---

## Checkpoint 2 — Platform DB schema + ModuleConfig type land cleanly

**Stop here. Do not start Phase 3 until every item below passes.**

**Testing suite:**

```bash
# 1. Type and lint
pnpm typecheck
pnpm lint

# 2. ModuleConfig Zod validation
pnpm test:run lib/shared/types.test.ts
# Expected: 5 tests pass

# 3. Platform schema generated and applied
ls platform/db/migrations/    # should contain at least one .sql file
pnpm db:migrate
# Expected: "no migrations to apply" if already current; otherwise applies cleanly

# 4. Schema is in Postgres
docker exec -i dashboard-postgres psql -U dashboard -d dashboard -c "\dn"
# Expected: includes "platform"
docker exec -i dashboard-postgres psql -U dashboard -d dashboard -c "\dt platform.*"
# Expected: share_links, widget_layouts, settings (sessions added in Phase 4)
```

**Manual verification:**

1. `pnpm db:studio` opens Drizzle Studio. Confirm `platform.share_links`, `platform.widget_layouts`, `platform.settings` tables are visible and empty.

**What this verifies:** Drizzle is correctly configured, the platform schema exists in Postgres, and the runtime ModuleConfig validator catches the rules Kevin cares about (kebab-case ids, schema-name match, cron validity).

---

# Phase 3: Module loader

The loader is the heart of the platform contract. It scans `modules/*/module.config.ts`, validates each manifest, checks file references exist on disk, and produces a registry consumed by the rest of the app.

## Task 3.1: TDD the discovery logic

**Files:**
- Create: `lib/shared/module-loader.ts`, `lib/shared/module-loader.test.ts`, `lib/shared/__fixtures__/`

- [ ] **Step 1: Write the failing test**

Create `lib/shared/module-loader.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { discoverModules, loadModuleConfig, validateModuleStructure } from './module-loader';

let tmpRoot: string;

function writeFile(p: string, content: string) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

function makeModule(root: string, id: string, configOverrides: Partial<Record<string, unknown>> = {}) {
  const dir = path.join(root, 'modules', id);
  const schema = id.replace(/-/g, '_');
  const config = {
    id,
    name: id,
    version: '0.0.1',
    description: 'test',
    enabled: true,
    icon: 'Box',
    nav: { label: id, order: 0 },
    routes: [{ path: '/', component: 'routes/index', shareable: false }],
    api: [],
    widgets: [],
    db: { schema },
    cron: [],
    env: { required: [], optional: [] },
    ...configOverrides,
  };
  writeFile(
    path.join(dir, 'module.config.ts'),
    `export default ${JSON.stringify(config, null, 2)} as const;\n`,
  );
  writeFile(path.join(dir, 'routes/index.tsx'), 'export default function P(){return null}\n');
  return dir;
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dash-mod-'));
  fs.mkdirSync(path.join(tmpRoot, 'modules'), { recursive: true });
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('discoverModules', () => {
  it('returns empty list when no modules', async () => {
    const result = await discoverModules(tmpRoot);
    expect(result).toEqual([]);
  });

  it('discovers a single valid module', async () => {
    makeModule(tmpRoot, 'job-tracker');
    const result = await discoverModules(tmpRoot);
    expect(result).toHaveLength(1);
    expect(result[0]!.config.id).toBe('job-tracker');
  });

  it('skips directories prefixed with underscore', async () => {
    makeModule(tmpRoot, 'job-tracker');
    makeModule(tmpRoot, '_template');
    const result = await discoverModules(tmpRoot);
    expect(result.map((m) => m.config.id)).toEqual(['job-tracker']);
  });

  it('rejects two modules with the same id', async () => {
    makeModule(tmpRoot, 'jobs');
    // Manually write a second module folder with the same id
    const dir = path.join(tmpRoot, 'modules', 'duplicate-folder');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'module.config.ts'),
      `export default ${JSON.stringify({
        id: 'jobs',
        name: 'x',
        version: '0.0.1',
        description: 'x',
        enabled: true,
        icon: 'Box',
        nav: { label: 'x', order: 0 },
        routes: [],
        api: [],
        widgets: [],
        db: { schema: 'jobs' },
        cron: [],
        env: { required: [], optional: [] },
      })};\n`,
    );
    await expect(discoverModules(tmpRoot)).rejects.toThrow(/duplicate.*id/i);
  });

  it('rejects modules where folder name does not match config id', async () => {
    const dir = path.join(tmpRoot, 'modules', 'wrong-folder');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'module.config.ts'),
      `export default ${JSON.stringify({
        id: 'right-id',
        name: 'x',
        version: '0.0.1',
        description: 'x',
        enabled: true,
        icon: 'Box',
        nav: { label: 'x', order: 0 },
        routes: [],
        api: [],
        widgets: [],
        db: { schema: 'right_id' },
        cron: [],
        env: { required: [], optional: [] },
      })};\n`,
    );
    await expect(discoverModules(tmpRoot)).rejects.toThrow(/folder.*id/i);
  });
});

describe('validateModuleStructure', () => {
  it('passes when all referenced files exist', async () => {
    const dir = makeModule(tmpRoot, 'good');
    await expect(
      validateModuleStructure(dir, {
        id: 'good',
        routes: [{ path: '/', component: 'routes/index', shareable: false }],
        api: [],
        widgets: [],
        cron: [],
      } as any),
    ).resolves.toBeUndefined();
  });

  it('throws when a referenced component file is missing', async () => {
    const dir = makeModule(tmpRoot, 'broken');
    await expect(
      validateModuleStructure(dir, {
        id: 'broken',
        routes: [{ path: '/', component: 'routes/missing', shareable: false }],
        api: [],
        widgets: [],
        cron: [],
      } as any),
    ).rejects.toThrow(/routes\/missing/);
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
pnpm test:run lib/shared/module-loader.test.ts
```

Expected: fails — module doesn't exist yet.

- [ ] **Step 3: Implement `lib/shared/module-loader.ts`**

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ModuleConfigSchema, type ModuleConfig } from './types';

export type LoadedModule = {
  dir: string;
  config: ModuleConfig;
};

export async function discoverModules(rootDir: string): Promise<LoadedModule[]> {
  const modulesDir = path.join(rootDir, 'modules');
  let entries: string[];
  try {
    entries = await fs.readdir(modulesDir);
  } catch {
    return [];
  }

  const loaded: LoadedModule[] = [];
  for (const entry of entries) {
    if (entry.startsWith('_') || entry.startsWith('.')) continue;
    const dir = path.join(modulesDir, entry);
    const stat = await fs.stat(dir);
    if (!stat.isDirectory()) continue;

    const config = await loadModuleConfig(dir);
    if (entry !== config.id) {
      throw new Error(
        `Module folder "${entry}" does not match config id "${config.id}" — folder name must equal id`,
      );
    }
    await validateModuleStructure(dir, config);
    loaded.push({ dir, config });
  }

  const ids = new Set<string>();
  for (const m of loaded) {
    if (ids.has(m.config.id)) {
      throw new Error(`Duplicate module id "${m.config.id}"`);
    }
    ids.add(m.config.id);
  }

  return loaded;
}

export async function loadModuleConfig(dir: string): Promise<ModuleConfig> {
  const configPath = path.join(dir, 'module.config.ts');
  await fs.access(configPath);

  // Dynamic import works in tsx/vite. In CI/build we rely on Next's bundler
  // to resolve these at build time; for the test environment, vitest handles TS.
  const url = pathToFileURL(configPath).href;
  const mod = (await import(/* @vite-ignore */ url)) as { default: unknown };
  return ModuleConfigSchema.parse(mod.default);
}

export async function validateModuleStructure(
  dir: string,
  config: Pick<ModuleConfig, 'id' | 'routes' | 'api' | 'widgets' | 'cron'>,
): Promise<void> {
  for (const route of config.routes) {
    await assertFileExists(dir, route.component, ['.tsx', '.ts']);
  }
  for (const widget of config.widgets) {
    await assertFileExists(dir, widget.component, ['.tsx', '.ts']);
  }
  // api entries map to app/api/<id>/* shim files which we generate later;
  // we only check that handler implementations exist under api/.
  for (const api of config.api) {
    const handlerName = api.path === '/' ? 'index' : api.path.replace(/^\//, '').replace(/\//g, '.');
    await assertFileExists(dir, path.join('api', handlerName), ['.ts']);
  }
  for (const cron of config.cron) {
    const expectedPrefix = `/api/${config.id}/`;
    if (!cron.handler.startsWith(expectedPrefix)) {
      throw new Error(
        `Cron handler "${cron.handler}" must start with "${expectedPrefix}"`,
      );
    }
  }
}

async function assertFileExists(dir: string, relative: string, extensions: string[]): Promise<void> {
  for (const ext of extensions) {
    try {
      await fs.access(path.join(dir, relative + ext));
      return;
    } catch {
      // try next extension
    }
  }
  throw new Error(`File not found at ${relative} (extensions: ${extensions.join(', ')}) in ${dir}`);
}
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
pnpm test:run lib/shared/module-loader.test.ts
```

Expected: all module-loader tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/module-loader.ts lib/shared/module-loader.test.ts
git commit -m "feat: add module loader with manifest discovery and structural validation"
```

## Task 3.2: TDD env-var validation

**Files:**
- Create: `lib/shared/env-validator.ts`, `lib/shared/env-validator.test.ts`

- [ ] **Step 1: Write the failing test**

Create `lib/shared/env-validator.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateRequiredEnv } from './env-validator';
import type { LoadedModule } from './module-loader';

function mod(id: string, required: string[]): LoadedModule {
  return {
    dir: `/fake/${id}`,
    config: {
      id,
      name: id,
      version: '0.0.1',
      description: '',
      enabled: true,
      icon: 'Box',
      nav: { label: id, order: 0 },
      routes: [],
      api: [],
      widgets: [],
      db: { schema: id.replace(/-/g, '_') },
      cron: [],
      env: { required, optional: [] },
    },
  } as LoadedModule;
}

describe('validateRequiredEnv', () => {
  it('passes when all required vars are present', () => {
    const env = { FOO: 'x', BAR: 'y' };
    expect(() => validateRequiredEnv([mod('a', ['FOO', 'BAR'])], env)).not.toThrow();
  });

  it('throws listing all missing vars across modules', () => {
    const env = { FOO: 'x' };
    expect(() =>
      validateRequiredEnv([mod('a', ['FOO', 'BAR']), mod('b', ['BAZ'])], env),
    ).toThrow(/BAR.*BAZ/s);
  });

  it('also checks platform-required vars', () => {
    const env = { DATABASE_URL: 'x' };
    expect(() => validateRequiredEnv([], env)).toThrow(
      /DASHBOARD_PASSWORD|SHARE_LINK_SIGNING_KEY|SESSION_COOKIE_SECRET/,
    );
  });
});
```

- [ ] **Step 2: Run the test (expect FAIL)**

```bash
pnpm test:run lib/shared/env-validator.test.ts
```

- [ ] **Step 3: Implement `lib/shared/env-validator.ts`**

```ts
import type { LoadedModule } from './module-loader';

const PLATFORM_REQUIRED = [
  'DATABASE_URL',
  'DASHBOARD_PASSWORD',
  'SHARE_LINK_SIGNING_KEY',
  'SESSION_COOKIE_SECRET',
] as const;

export function validateRequiredEnv(
  modules: LoadedModule[],
  env: Record<string, string | undefined> = process.env,
): void {
  const missing: string[] = [];

  for (const key of PLATFORM_REQUIRED) {
    if (!env[key]) missing.push(`${key} (platform)`);
  }

  for (const m of modules) {
    for (const key of m.config.env.required) {
      if (!env[key]) missing.push(`${key} (module: ${m.config.id})`);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n  - ${missing.join('\n  - ')}`,
    );
  }
}
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
pnpm test:run lib/shared/env-validator.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/shared/env-validator.ts lib/shared/env-validator.test.ts
git commit -m "feat: add env-var validator for platform and module requirements"
```

## Task 3.3: Module registry singleton

**Files:**
- Create: `lib/shared/registry.ts`

The registry is the runtime-side accessor for discovered modules. It caches results so we don't re-scan the filesystem on every request.

- [ ] **Step 1: Write `lib/shared/registry.ts`**

```ts
import 'server-only';
import * as path from 'node:path';
import { discoverModules, type LoadedModule } from './module-loader';
import { validateRequiredEnv } from './env-validator';

let cached: Promise<LoadedModule[]> | null = null;

export function getModules(rootDir: string = process.cwd()): Promise<LoadedModule[]> {
  if (!cached) {
    cached = (async () => {
      const modules = await discoverModules(rootDir);
      const enabled = modules.filter((m) => m.config.enabled);
      validateRequiredEnv(enabled);
      return enabled;
    })();
  }
  return cached;
}

export function getModuleById(id: string): Promise<LoadedModule | undefined> {
  return getModules().then((mods) => mods.find((m) => m.config.id === id));
}

// Test-only — clears the cache between test runs.
export function __resetModuleRegistry() {
  cached = null;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/shared/registry.ts
git commit -m "feat: add cached module registry singleton"
```

## Task 3.4: ESLint rule banning cross-module imports

**Files:**
- Create: `eslint-rules/no-cross-module-imports.js`, `eslint-rules/no-cross-module-imports.test.js`
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Install ESLint rule-testing harness**

```bash
pnpm add -D @typescript-eslint/rule-tester
```

- [ ] **Step 2: Write the rule test**

Create `eslint-rules/no-cross-module-imports.test.js`:

```js
const { RuleTester } = require('@typescript-eslint/rule-tester');
const rule = require('./no-cross-module-imports');

const ruleTester = new RuleTester();

ruleTester.run('no-cross-module-imports', rule, {
  valid: [
    { code: "import x from '@/lib/shared/auth'", filename: 'modules/jobs/lib/x.ts' },
    { code: "import x from './local'", filename: 'modules/jobs/lib/x.ts' },
    { code: "import x from '@/modules/jobs/lib/queries'", filename: 'modules/jobs/routes/index.tsx' },
    { code: "import x from '@/modules/expenses/lib/public-api'", filename: 'modules/jobs/lib/x.ts' },
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
```

- [ ] **Step 3: Run the test (expect FAIL — rule not implemented)**

```bash
node eslint-rules/no-cross-module-imports.test.js
```

Expected: error about missing `./no-cross-module-imports`.

- [ ] **Step 4: Implement `eslint-rules/no-cross-module-imports.js`**

```js
'use strict';

const MODULE_PATH = /^@\/modules\/([^/]+)\/(.*)$/;

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow imports from another module except via that module\'s lib/public-api',
    },
    messages: {
      crossModule:
        'Cross-module imports are forbidden. Import only from `@/modules/<other>/lib/public-api`.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename || context.getFilename();
    const fileMatch = filename.match(/modules\/([^/]+)\//);
    const currentModule = fileMatch ? fileMatch[1] : null;

    function check(node, importPath) {
      const m = importPath.match(MODULE_PATH);
      if (!m) return;
      const [, importedModule, rest] = m;
      if (!currentModule) return; // outside any module, skip
      if (importedModule === currentModule) return;
      if (rest === 'lib/public-api' || rest === 'lib/public-api.ts') return;
      context.report({ node, messageId: 'crossModule' });
    }

    return {
      ImportDeclaration(node) {
        check(node, node.source.value);
      },
      ImportExpression(node) {
        if (node.source.type === 'Literal' && typeof node.source.value === 'string') {
          check(node, node.source.value);
        }
      },
    };
  },
};
```

- [ ] **Step 5: Run test (expect PASS)**

```bash
node eslint-rules/no-cross-module-imports.test.js
```

Expected: `no-cross-module-imports tests passed`.

- [ ] **Step 6: Wire rule into ESLint config**

Edit `eslint.config.mjs` (or `.eslintrc.json` if that's what was generated). For flat config, add:

```js
import localRules from './eslint-rules/index.js';

export default [
  // ...existing,
  {
    plugins: {
      local: localRules,
    },
    rules: {
      'local/no-cross-module-imports': 'error',
    },
  },
];
```

Create `eslint-rules/index.js`:

```js
module.exports = {
  rules: {
    'no-cross-module-imports': require('./no-cross-module-imports'),
  },
};
```

- [ ] **Step 7: Run `pnpm lint`**

```bash
pnpm lint
```

Expected: passes (no modules yet, so no cross-module imports exist).

- [ ] **Step 8: Commit**

```bash
git add eslint-rules/ eslint.config.mjs
git commit -m "feat: add ESLint rule banning cross-module imports"
```

---

## Checkpoint 3 — Module loader, env validator, and cross-module ESLint rule work

**Stop here. Do not start Phase 4 until every item below passes.**

**Testing suite:**

```bash
# 1. Loader unit tests (uses tmp filesystem fixtures)
pnpm test:run lib/shared/module-loader.test.ts
# Expected: all module-loader tests pass

# 2. Env validator
pnpm test:run lib/shared/env-validator.test.ts
# Expected: 3 tests pass

# 3. ESLint custom rule
node eslint-rules/no-cross-module-imports.test.js
# Expected: "no-cross-module-imports tests passed"

# 4. Full lint pass against the repo
pnpm lint
# Expected: no errors

# 5. All unit tests still pass
pnpm test:run
# Expected: every test we have so far passes
```

**Manual verification:**

1. Read `lib/shared/module-loader.ts` and confirm the file references the same `ModuleConfigSchema` we defined in Phase 2 (no duplication).
2. Confirm `eslint.config.mjs` includes the `local/no-cross-module-imports` rule.

**What this verifies:** the manifest discovery + structural validation + env-var validation + cross-module-import enforcement are all in place. The platform now has the rails that every module will run on.

---

# Phase 4: Auth & sessions

Single-user password auth with signed session cookies. The `getSession()` abstraction returns either an owner session or a guest session (the latter set by share-link entry, implemented in Phase 7).

## Task 4.1: Sessions table

**Files:**
- Modify: `platform/db/schema.ts`
- Add migration via `pnpm db:generate`

- [ ] **Step 1: Add sessions table to platform schema**

In `platform/db/schema.ts`, append:

```ts
export const sessions = platform.table('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  ip: text('ip'),
  userAgent: text('user_agent'),
});
```

- [ ] **Step 2: Generate and apply migration**

```bash
pnpm db:generate
pnpm db:migrate
```

- [ ] **Step 3: Commit**

```bash
git add platform/db/
git commit -m "feat: add platform.sessions table for owner sessions"
```

## Task 4.2: TDD password verification

**Files:**
- Create: `lib/shared/password.ts`, `lib/shared/password.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { verifyPassword } from './password';

describe('verifyPassword', () => {
  it('returns true on exact match', () => {
    expect(verifyPassword('hunter2', 'hunter2')).toBe(true);
  });
  it('returns false on mismatch', () => {
    expect(verifyPassword('hunter2', 'wrong')).toBe(false);
  });
  it('returns false on empty input', () => {
    expect(verifyPassword('', 'hunter2')).toBe(false);
  });
  it('uses constant-time comparison (length-mismatch returns false)', () => {
    expect(verifyPassword('short', 'longerpassword')).toBe(false);
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
pnpm test:run lib/shared/password.test.ts
```

- [ ] **Step 3: Implement**

`lib/shared/password.ts`:

```ts
import { timingSafeEqual } from 'node:crypto';

export function verifyPassword(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run (expect PASS)**

```bash
pnpm test:run lib/shared/password.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/shared/password.ts lib/shared/password.test.ts
git commit -m "feat: add constant-time password verification"
```

## Task 4.3: TDD session token signing/verification

**Files:**
- Create: `lib/shared/session-token.ts`, `lib/shared/session-token.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { signSessionToken, verifySessionToken } from './session-token';

const SECRET = 'a'.repeat(64);

describe('session token', () => {
  it('round-trips a payload', () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    const payload = verifySessionToken(token, SECRET);
    expect(payload).toEqual({ sid: 'abc', exp: 9999999999 });
  });

  it('rejects tampered tokens', () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    const tampered = token.slice(0, -2) + 'aa';
    expect(verifySessionToken(tampered, SECRET)).toBeNull();
  });

  it('rejects tokens signed with a different secret', () => {
    const token = signSessionToken({ sid: 'abc', exp: 9999999999 }, SECRET);
    expect(verifySessionToken(token, 'b'.repeat(64))).toBeNull();
  });

  it('rejects expired tokens', () => {
    const token = signSessionToken({ sid: 'abc', exp: 1 }, SECRET);
    expect(verifySessionToken(token, SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
pnpm test:run lib/shared/session-token.test.ts
```

- [ ] **Step 3: Implement `lib/shared/session-token.ts`**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type SessionPayload = {
  sid: string;
  exp: number; // unix seconds
};

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

export function signSessionToken(payload: SessionPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifySessionToken(token: string, secret: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  if (!body || !sig) return null;

  const expectedSig = createHmac('sha256', secret).update(body).digest();
  const providedSig = b64urlDecode(sig);
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf-8'));
  } catch {
    return null;
  }
  if (typeof payload.sid !== 'string' || typeof payload.exp !== 'number') return null;
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}
```

- [ ] **Step 4: Run (expect PASS)**

```bash
pnpm test:run lib/shared/session-token.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/shared/session-token.ts lib/shared/session-token.test.ts
git commit -m "feat: add HMAC-signed session tokens"
```

## Task 4.4: Auth helpers — `getSession`, `requireOwner`

**Files:**
- Create: `lib/shared/auth.ts`, `lib/shared/auth.test.ts`

This module reads cookies via Next.js's `cookies()` helper. We'll provide a thin injectable interface for testing.

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { resolveSession } from './auth';
import { signSessionToken } from './session-token';

const SECRET = 'a'.repeat(64);

describe('resolveSession', () => {
  it('returns owner when valid session cookie present', () => {
    const token = signSessionToken({ sid: 'sess-1', exp: 9999999999 }, SECRET);
    const result = resolveSession({ sessionCookie: token, shareScope: null, secret: SECRET });
    expect(result).toEqual({ role: 'owner' });
  });

  it('returns guest when shareScope present and no session cookie', () => {
    const result = resolveSession({
      sessionCookie: null,
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
      secret: SECRET,
    });
    expect(result).toEqual({
      role: 'guest',
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
    });
  });

  it('returns null when no auth context', () => {
    const result = resolveSession({ sessionCookie: null, shareScope: null, secret: SECRET });
    expect(result).toBeNull();
  });

  it('prefers owner over guest when both present', () => {
    const token = signSessionToken({ sid: 'sess-1', exp: 9999999999 }, SECRET);
    const result = resolveSession({
      sessionCookie: token,
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
      secret: SECRET,
    });
    expect(result).toEqual({ role: 'owner' });
  });

  it('falls through to guest when session cookie invalid', () => {
    const result = resolveSession({
      sessionCookie: 'invalid.token',
      shareScope: { moduleId: 'jobs', route: '/pipeline', tokenId: 'tok-1' },
      secret: SECRET,
    });
    expect(result?.role).toBe('guest');
  });
});
```

- [ ] **Step 2: Run (expect FAIL)**

```bash
pnpm test:run lib/shared/auth.test.ts
```

- [ ] **Step 3: Implement `lib/shared/auth.ts`**

```ts
import 'server-only';
import { cookies } from 'next/headers';
import { verifySessionToken } from './session-token';

export const SESSION_COOKIE = 'dashboard_session';

export type ShareScope = { moduleId: string; route: string; tokenId: string };
export type Session =
  | { role: 'owner' }
  | { role: 'guest'; shareScope: ShareScope };

export type SessionInput = {
  sessionCookie: string | null;
  shareScope: ShareScope | null;
  secret: string;
};

export function resolveSession(input: SessionInput): Session | null {
  if (input.sessionCookie) {
    const payload = verifySessionToken(input.sessionCookie, input.secret);
    if (payload) return { role: 'owner' };
  }
  if (input.shareScope) {
    return { role: 'guest', shareScope: input.shareScope };
  }
  return null;
}

// Next.js entrypoints — used by server components and route handlers.
// The shareScope is set by the share-link middleware in Phase 7.
export async function getSession(shareScope: ShareScope | null = null): Promise<Session | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value ?? null;
  const secret = process.env.SESSION_COOKIE_SECRET;
  if (!secret) throw new Error('SESSION_COOKIE_SECRET is not set');
  return resolveSession({ sessionCookie, shareScope, secret });
}

export async function requireOwner(): Promise<void> {
  const session = await getSession();
  if (!session || session.role !== 'owner') {
    throw new ForbiddenError('Owner required');
  }
}

export class ForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ForbiddenError';
  }
}
```

- [ ] **Step 4: Run (expect PASS)**

```bash
pnpm test:run lib/shared/auth.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/shared/auth.ts lib/shared/auth.test.ts
git commit -m "feat: add getSession/resolveSession/requireOwner helpers"
```

## Task 4.5: Login route + page

**Files:**
- Create: `app/login/page.tsx`, `app/login/actions.ts`

- [ ] **Step 1: Write `app/login/actions.ts`**

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/shared/db';
import { sessions } from '@/platform/db/schema';
import { signSessionToken } from '@/lib/shared/session-token';
import { verifyPassword } from '@/lib/shared/password';
import { SESSION_COOKIE } from '@/lib/shared/auth';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const password = String(formData.get('password') ?? '');
  const expected = process.env.DASHBOARD_PASSWORD;
  const secret = process.env.SESSION_COOKIE_SECRET;
  if (!expected || !secret) {
    return { error: 'Server misconfigured' };
  }
  if (!verifyPassword(password, expected)) {
    return { error: 'Incorrect password' };
  }

  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  const [session] = await db
    .insert(sessions)
    .values({ expiresAt })
    .returning({ id: sessions.id });

  if (!session) return { error: 'Could not create session' };

  const token = signSessionToken(
    { sid: session.id, exp: Math.floor(expiresAt.getTime() / 1000) },
    secret,
  );

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });

  redirect('/');
}
```

- [ ] **Step 2: Write `app/login/page.tsx`**

```tsx
import { loginAction } from './actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={loginAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" autoFocus required />
            </div>
            <Button type="submit" className="w-full">Sign in</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 3: Verify it renders**

```bash
pnpm dev
```

Visit `http://localhost:3000/login`. Expected: form renders.

- [ ] **Step 4: Test login flow manually**

Submit the form with the password in `.env.local`. Expected: redirects to `/` and the `dashboard_session` cookie is set.

- [ ] **Step 5: Commit**

```bash
git add app/login/
git commit -m "feat: add password login page and session-creation action"
```

## Task 4.6: Auth middleware

**Files:**
- Create: `middleware.ts` (at repo root — Next.js looks here)

- [ ] **Step 1: Write `middleware.ts`**

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/shared/auth';
import { verifySessionToken } from '@/lib/shared/session-token';

const PUBLIC_PATHS = ['/login', '/share', '/_next', '/favicon.ico', '/api/health'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  const secret = process.env.SESSION_COOKIE_SECRET;
  const valid = cookie && secret ? !!verifySessionToken(cookie, secret) : false;

  if (!valid) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 2: Verify by visiting `/` without a session**

Clear the cookie in the browser, visit `http://localhost:3000/`. Expected: redirect to `/login`.

- [ ] **Step 3: Verify auth path works**

Log in. Expected: lands on `/`.

- [ ] **Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat: add auth middleware redirecting unauthenticated requests to /login"
```

---

## Checkpoint 4 — Password login + session middleware actually gate the app

**Stop here. Do not start Phase 5 until every item below passes.**

**Testing suite:**

```bash
# 1. All auth-layer unit tests
pnpm test:run lib/shared/password.test.ts lib/shared/session-token.test.ts lib/shared/auth.test.ts
# Expected: every test passes

# 2. Sessions table exists
docker exec -i dashboard-postgres psql -U dashboard -d dashboard -c "\dt platform.sessions"
# Expected: row for platform.sessions

# 3. Full lint + typecheck + tests
pnpm lint && pnpm typecheck && pnpm test:run
```

**Manual verification (do these in a fresh incognito window):**

1. `pnpm dev`. Visit http://localhost:3000/. Expected: redirected to `/login?next=%2F`.
2. Submit the login form with the WRONG password. Expected: stays on `/login`, no session cookie set, no `dashboard_session` cookie present in DevTools.
3. Submit the form with the correct password from `.env.local`. Expected: redirected to `/`. DevTools shows `dashboard_session` cookie set httpOnly.
4. Open `psql` and `SELECT id, created_at, expires_at FROM platform.sessions;` — there is exactly one row matching the just-issued session.
5. Visit `/login` again while signed in. Expected: nothing crashes (the page renders; we don't auto-redirect away yet — that's fine).
6. Delete the cookie manually in DevTools. Reload `/`. Expected: redirected back to `/login`.

**What this verifies:** the password gate is real, sessions are persisted server-side, the cookie is signed/verified, and middleware properly bounces unauthenticated traffic.

---

# Phase 5: Shell UI

Layout with sidebar, home page placeholder, admin page skeleton. Sidebar built from the module registry.

## Task 5.1: Shell layout with sidebar

**Files:**
- Modify: `app/layout.tsx`, `app/page.tsx`
- Create: `app/(shell)/layout.tsx`, `components/shell/Sidebar.tsx`, `lib/shared/icons.ts`

We use a route group `(shell)` to group all authenticated dashboard routes under a common layout.

- [ ] **Step 1: Move `app/page.tsx` into the shell group**

```bash
mkdir -p app/\(shell\)
git mv app/page.tsx app/\(shell\)/page.tsx
```

(If git mv fails because the file was already moved or auto-generated differently, do the move manually with `mv`.)

- [ ] **Step 2: Create `app/(shell)/layout.tsx`**

```tsx
import { getModules } from '@/lib/shared/registry';
import { Sidebar } from '@/components/shell/Sidebar';

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const modules = await getModules();
  return (
    <div className="flex min-h-screen">
      <Sidebar modules={modules.map((m) => m.config)} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Create `components/shell/Sidebar.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Settings, type LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModuleConfig } from '@/lib/shared/types';

type Props = { modules: ModuleConfig[] };

function resolveIcon(name: string): LucideIcon {
  const Icon = (LucideIcons as unknown as Record<string, LucideIcon | undefined>)[name];
  return Icon ?? (LucideIcons.Box as LucideIcon);
}

export function Sidebar({ modules }: Props) {
  const pathname = usePathname();
  const sorted = [...modules].sort((a, b) => a.nav.order - b.nav.order);

  return (
    <aside className="w-56 border-r bg-slate-50 p-4">
      <div className="mb-6 text-lg font-semibold">Dashboard</div>
      <nav className="space-y-1">
        <NavItem href="/" icon={Home} label="Home" active={pathname === '/'} />
        {sorted.map((m) => {
          const Icon = resolveIcon(m.icon);
          const href = `/${m.id}`;
          return (
            <NavItem
              key={m.id}
              href={href}
              icon={Icon}
              label={m.nav.label}
              active={pathname === href || pathname.startsWith(href + '/')}
            />
          );
        })}
        <div className="pt-4">
          <NavItem
            href="/admin"
            icon={Settings}
            label="Admin"
            active={pathname.startsWith('/admin')}
          />
        </div>
      </nav>
    </aside>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded px-3 py-2 text-sm',
        active ? 'bg-slate-200 font-medium' : 'hover:bg-slate-100',
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
```

- [ ] **Step 4: Replace `app/(shell)/page.tsx` with a placeholder home**

```tsx
export default function HomePage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Home</h1>
      <p className="text-sm text-slate-600">Widget grid will live here.</p>
    </div>
  );
}
```

- [ ] **Step 5: Verify dev server**

```bash
pnpm dev
```

Visit `/`, log in. Expected: sidebar visible (only Home + Admin since no modules), placeholder home content.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shell layout with dynamic sidebar built from module registry"
```

## Task 5.2: Admin skeleton + logout

**Files:**
- Create: `app/(shell)/admin/page.tsx`, `app/(shell)/admin/actions.ts`

- [ ] **Step 1: Write `app/(shell)/admin/actions.ts`**

```ts
'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE } from '@/lib/shared/auth';

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect('/login');
}
```

- [ ] **Step 2: Write `app/(shell)/admin/page.tsx`**

```tsx
import { getModules } from '@/lib/shared/registry';
import { logoutAction } from './actions';
import { Button } from '@/components/ui/button';

export default async function AdminPage() {
  const modules = await getModules();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Modules</h2>
        <ul className="space-y-1 text-sm">
          {modules.length === 0 && <li className="text-slate-500">No modules installed.</li>}
          {modules.map((m) => (
            <li key={m.config.id}>
              <span className="font-mono">{m.config.id}</span> — {m.config.name} (v{m.config.version})
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Session</h2>
        <form action={logoutAction}>
          <Button type="submit" variant="outline">Sign out</Button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Verify in browser**

Visit `/admin`. Expected: page renders, sign out works.

- [ ] **Step 4: Commit**

```bash
git add app/\(shell\)/admin/
git commit -m "feat: add admin skeleton with module list and logout"
```

---

## Checkpoint 5 — Sidebar shell and admin skeleton render correctly

**Stop here. Do not start Phase 6 until every item below passes.**

**Testing suite:**

```bash
pnpm lint && pnpm typecheck && pnpm test:run
pnpm build
# Expected: build completes with no errors
```

**Manual verification:**

1. `pnpm dev` and sign in.
2. `/` shows the sidebar on the left with `Home` and `Admin` items only (no modules yet). The right pane shows the placeholder "Home" heading.
3. Sidebar links navigate correctly: clicking `Admin` highlights it and shows the admin page.
4. `/admin` lists "No modules installed." (true at this point) and shows a working "Sign out" button.
5. Click "Sign out". Expected: redirected to `/login`, cookie cleared.

**What this verifies:** the shell layout is in place, the sidebar is driven by the module registry (not hardcoded), and admin/auth roundtripping works.

---

# Phase 6: Platform utilities

Logger, withErrorHandler, error boundaries.

## Task 6.1: TDD logger

**Files:**
- Create: `lib/shared/logger.ts`, `lib/shared/logger.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createLogger } from './logger';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createLogger', () => {
  it('emits a JSON line with auto-injected context', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const log = createLogger({ moduleId: 'jobs', route: '/x' });
    log.info('hello', { extra: 1 });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload.level).toBe('info');
    expect(payload.moduleId).toBe('jobs');
    expect(payload.route).toBe('/x');
    expect(payload.message).toBe('hello');
    expect(payload.extra).toBe(1);
    expect(typeof payload.timestamp).toBe('string');
  });

  it('emits error level to console.error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log = createLogger({ moduleId: 'jobs' });
    log.error('boom', { err: 'x' });
    expect(spy).toHaveBeenCalledOnce();
    const payload = JSON.parse(spy.mock.calls[0]![0] as string);
    expect(payload.level).toBe('error');
  });
});
```

- [ ] **Step 2: Run (FAIL)**

```bash
pnpm test:run lib/shared/logger.test.ts
```

- [ ] **Step 3: Implement `lib/shared/logger.ts`**

```ts
type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type Context = { moduleId?: string; route?: string };

export function createLogger(ctx: Context = {}) {
  function emit(level: LogLevel, message: string, fields?: Record<string, unknown>) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      ...ctx,
      message,
      ...(fields ?? {}),
    };
    const serialized = JSON.stringify(payload);
    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else {
      console.log(serialized);
    }
  }

  return {
    debug: (m: string, f?: Record<string, unknown>) => emit('debug', m, f),
    info: (m: string, f?: Record<string, unknown>) => emit('info', m, f),
    warn: (m: string, f?: Record<string, unknown>) => emit('warn', m, f),
    error: (m: string, f?: Record<string, unknown>) => emit('error', m, f),
  };
}

export const logger = createLogger();
```

- [ ] **Step 4: Run (PASS)**

```bash
pnpm test:run lib/shared/logger.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/shared/logger.ts lib/shared/logger.test.ts
git commit -m "feat: add structured JSON logger with auto-injected context"
```

## Task 6.2: TDD `withErrorHandler`

**Files:**
- Create: `lib/shared/errors.ts`, `lib/shared/with-error-handler.ts`, `lib/shared/with-error-handler.test.ts`

- [ ] **Step 1: Implement error classes first (no test needed — pure structural)**

`lib/shared/errors.ts`:

```ts
export class NotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}
```

- [ ] **Step 2: Write the wrapper test**

`lib/shared/with-error-handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { withErrorHandler } from './with-error-handler';
import { NotFoundError, ForbiddenError, UnauthorizedError } from './errors';
import { ZodError, z } from 'zod';

function makeReq(): Request {
  return new Request('http://localhost/x');
}

describe('withErrorHandler', () => {
  it('passes through a successful response', async () => {
    const handler = withErrorHandler('jobs', async () => new Response('ok'));
    const res = await handler(makeReq());
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('maps NotFoundError to 404', async () => {
    const handler = withErrorHandler('jobs', async () => {
      throw new NotFoundError('missing');
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'NotFound', message: 'missing' });
  });

  it('maps ForbiddenError to 403', async () => {
    const handler = withErrorHandler('jobs', async () => {
      throw new ForbiddenError();
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(403);
  });

  it('maps UnauthorizedError to 401', async () => {
    const handler = withErrorHandler('jobs', async () => {
      throw new UnauthorizedError();
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(401);
  });

  it('maps ZodError to 400 with issues', async () => {
    const schema = z.object({ x: z.number() });
    const handler = withErrorHandler('jobs', async () => {
      schema.parse({});
      return new Response('unreachable');
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('ValidationError');
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it('maps unknown errors to 500 with sanitized message', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handler = withErrorHandler('jobs', async () => {
      throw new Error('secret internal detail');
    });
    const res = await handler(makeReq());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: 'InternalError' });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 3: Run (FAIL)**

```bash
pnpm test:run lib/shared/with-error-handler.test.ts
```

- [ ] **Step 4: Implement `lib/shared/with-error-handler.ts`**

```ts
import { ZodError } from 'zod';
import { createLogger } from './logger';
import { NotFoundError, ForbiddenError, UnauthorizedError } from './errors';

type Handler = (req: Request, ctx?: { params?: Record<string, string> }) => Promise<Response>;

export function withErrorHandler(moduleId: string, handler: Handler): Handler {
  const log = createLogger({ moduleId });
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return Response.json(
          { error: 'ValidationError', issues: err.issues },
          { status: 400 },
        );
      }
      if (err instanceof NotFoundError) {
        return Response.json({ error: 'NotFound', message: err.message }, { status: 404 });
      }
      if (err instanceof ForbiddenError) {
        return Response.json({ error: 'Forbidden', message: err.message }, { status: 403 });
      }
      if (err instanceof UnauthorizedError) {
        return Response.json({ error: 'Unauthorized', message: err.message }, { status: 401 });
      }
      log.error('unhandled exception', {
        err: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : err,
        url: req.url,
      });
      return Response.json({ error: 'InternalError' }, { status: 500 });
    }
  };
}
```

- [ ] **Step 5: Run (PASS)**

```bash
pnpm test:run lib/shared/with-error-handler.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/shared/errors.ts lib/shared/with-error-handler.ts lib/shared/with-error-handler.test.ts
git commit -m "feat: add typed error classes and withErrorHandler wrapper for API routes"
```

## Task 6.3: Error boundaries

**Files:**
- Create: `components/shell/boundaries/ModuleErrorBoundary.tsx`, `components/shell/boundaries/WidgetErrorBoundary.tsx`, `app/error.tsx`
- Modify: `app/(shell)/layout.tsx`

- [ ] **Step 1: Create `app/error.tsx` (shell-level)**

```tsx
'use client';

export default function ShellError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold">Something broke.</h1>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
          <button
            onClick={reset}
            className="mt-4 rounded bg-slate-900 px-3 py-2 text-sm text-white"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Create `components/shell/boundaries/ModuleErrorBoundary.tsx`**

```tsx
'use client';

import { Component, type ReactNode } from 'react';

type Props = { moduleName: string; children: ReactNode };
type State = { error: Error | null };

export class ModuleErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(JSON.stringify({
      level: 'error',
      moduleId: this.props.moduleName,
      message: 'Module boundary caught error',
      err: { name: error.name, message: error.message, stack: error.stack },
    }));
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="font-medium">{this.props.moduleName} is having problems.</p>
          <p className="mt-1 text-slate-600">
            The rest of the dashboard is still working.{' '}
            <a href="/" className="underline">Back to home</a>.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 3: Create `components/shell/boundaries/WidgetErrorBoundary.tsx`**

```tsx
'use client';

import { Component, type ReactNode } from 'react';

type Props = { widgetName: string; children: ReactNode };
type State = { error: Error | null };

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(JSON.stringify({
      level: 'error',
      message: 'Widget boundary caught error',
      widget: this.props.widgetName,
      err: { name: error.name, message: error.message },
    }));
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          {this.props.widgetName} unavailable
        </div>
      );
    }
    return this.props.children;
  }
}
```

- [ ] **Step 4: Verify pages still build**

```bash
pnpm build
```

Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add app/error.tsx components/shell/boundaries/
git commit -m "feat: add shell, module, and widget error boundaries"
```

---

## Checkpoint 6 — Logger, error wrapper, and boundaries are testable

**Stop here. Do not start Phase 7 until every item below passes.**

**Testing suite:**

```bash
pnpm test:run lib/shared/logger.test.ts lib/shared/with-error-handler.test.ts
# Expected: all logger + error-handler tests pass

pnpm test:run         # everything still green
pnpm lint && pnpm typecheck
pnpm build            # boundaries must compile as client components
```

**Manual verification (deliberate-break exercise):**

1. Temporarily edit `app/(shell)/admin/page.tsx` and add `throw new Error('boom — verifying boundary');` at the top of the component.
2. `pnpm dev`, sign in, visit `/admin`. Expected: a friendly error UI from `app/error.tsx` (NOT the Next.js default error overlay in prod — for dev, the overlay may appear; that's fine. The point is the shell didn't white-screen.)
3. Revert the `throw`.
4. Visit any URL — confirm normal behavior restored.

**What this verifies:** the logging convention emits structured JSON, the error wrapper maps errors to typed responses, and the boundary components actually catch.

---

# Phase 7: Share links

HMAC-signed share links scoped to a module + route. Validated on entry, recorded in `platform.share_links` for revocation.

## Task 7.1: TDD share-link signing/verification

**Files:**
- Create: `lib/shared/share-links.ts`, `lib/shared/share-links.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { signShareToken, verifyShareToken } from './share-links';

const SECRET = 'a'.repeat(64);

describe('share-link tokens', () => {
  it('round-trips a payload', () => {
    const token = signShareToken(
      { tokenId: 't1', moduleId: 'jobs', route: '/pipeline', exp: 9999999999 },
      SECRET,
    );
    const payload = verifyShareToken(token, SECRET);
    expect(payload).toEqual({
      tokenId: 't1',
      moduleId: 'jobs',
      route: '/pipeline',
      exp: 9999999999,
    });
  });

  it('round-trips a payload with no expiry', () => {
    const token = signShareToken(
      { tokenId: 't1', moduleId: 'jobs', route: '/pipeline' },
      SECRET,
    );
    const payload = verifyShareToken(token, SECRET);
    expect(payload).toEqual({ tokenId: 't1', moduleId: 'jobs', route: '/pipeline' });
  });

  it('rejects expired tokens', () => {
    const token = signShareToken(
      { tokenId: 't1', moduleId: 'jobs', route: '/pipeline', exp: 1 },
      SECRET,
    );
    expect(verifyShareToken(token, SECRET)).toBeNull();
  });

  it('rejects tampered tokens', () => {
    const token = signShareToken({ tokenId: 't1', moduleId: 'jobs', route: '/pipeline' }, SECRET);
    expect(verifyShareToken(token.slice(0, -2) + 'aa', SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run (FAIL)**

```bash
pnpm test:run lib/shared/share-links.test.ts
```

- [ ] **Step 3: Implement `lib/shared/share-links.ts` (signing portion)**

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

export type ShareTokenPayload = {
  tokenId: string;
  moduleId: string;
  route: string;
  exp?: number;
};

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s, 'base64url');
}

export function signShareToken(payload: ShareTokenPayload, secret: string): string {
  const body = b64url(Buffer.from(JSON.stringify(payload)));
  const sig = b64url(createHmac('sha256', secret).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyShareToken(token: string, secret: string): ShareTokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expectedSig = createHmac('sha256', secret).update(body).digest();
  const providedSig = b64urlDecode(sig);
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: ShareTokenPayload;
  try {
    payload = JSON.parse(b64urlDecode(body).toString('utf-8'));
  } catch {
    return null;
  }
  if (typeof payload.tokenId !== 'string' || typeof payload.moduleId !== 'string' || typeof payload.route !== 'string') {
    return null;
  }
  if (payload.exp !== undefined) {
    if (typeof payload.exp !== 'number') return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
  }
  return payload;
}
```

- [ ] **Step 4: Run (PASS)**

```bash
pnpm test:run lib/shared/share-links.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/shared/share-links.ts lib/shared/share-links.test.ts
git commit -m "feat: add HMAC signing/verification for share-link tokens"
```

## Task 7.2: DB-side share-link create/revoke + validity check

**Files:**
- Modify: `lib/shared/share-links.ts` (append)
- Create: `lib/shared/share-links.integration.test.ts`

This is an integration-tier test that requires a running DB.

- [ ] **Step 1: Append CRUD operations to `lib/shared/share-links.ts`**

```ts
import { db } from './db';
import { shareLinks } from '@/platform/db/schema';
import { eq, isNull } from 'drizzle-orm';

export async function createShareLink(input: {
  moduleId: string;
  route: string;
  label?: string;
  expiresAt?: Date;
}): Promise<{ token: string; tokenId: string }> {
  const secret = process.env.SHARE_LINK_SIGNING_KEY;
  if (!secret) throw new Error('SHARE_LINK_SIGNING_KEY is not set');

  const [row] = await db
    .insert(shareLinks)
    .values({
      moduleId: input.moduleId,
      route: input.route,
      label: input.label ?? null,
      expiresAt: input.expiresAt ?? null,
    })
    .returning({ id: shareLinks.id });

  if (!row) throw new Error('Failed to create share link');

  const token = signShareToken(
    {
      tokenId: row.id,
      moduleId: input.moduleId,
      route: input.route,
      ...(input.expiresAt ? { exp: Math.floor(input.expiresAt.getTime() / 1000) } : {}),
    },
    secret,
  );

  return { token, tokenId: row.id };
}

export async function revokeShareLink(tokenId: string): Promise<void> {
  await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(shareLinks.id, tokenId));
}

export async function listShareLinks() {
  return db.select().from(shareLinks).where(isNull(shareLinks.revokedAt));
}

export async function isShareTokenActive(tokenId: string): Promise<boolean> {
  const rows = await db.select().from(shareLinks).where(eq(shareLinks.id, tokenId));
  const row = rows[0];
  if (!row) return false;
  if (row.revokedAt) return false;
  if (row.expiresAt && row.expiresAt.getTime() < Date.now()) return false;
  return true;
}
```

- [ ] **Step 2: Write `lib/shared/share-links.integration.test.ts`**

```ts
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from './db';
import { shareLinks } from '@/platform/db/schema';
import {
  createShareLink,
  revokeShareLink,
  isShareTokenActive,
  verifyShareToken,
} from './share-links';

beforeAll(() => {
  if (!process.env.SHARE_LINK_SIGNING_KEY) process.env.SHARE_LINK_SIGNING_KEY = 'a'.repeat(64);
});

beforeEach(async () => {
  await db.delete(shareLinks);
});

describe('share link DB ops', () => {
  it('creates and verifies an active token', async () => {
    const { token, tokenId } = await createShareLink({
      moduleId: 'jobs',
      route: '/pipeline',
    });
    const payload = verifyShareToken(token, process.env.SHARE_LINK_SIGNING_KEY!);
    expect(payload?.tokenId).toBe(tokenId);
    expect(await isShareTokenActive(tokenId)).toBe(true);
  });

  it('marks revoked links inactive', async () => {
    const { tokenId } = await createShareLink({ moduleId: 'jobs', route: '/pipeline' });
    await revokeShareLink(tokenId);
    expect(await isShareTokenActive(tokenId)).toBe(false);
  });

  it('marks expired links inactive', async () => {
    const { tokenId } = await createShareLink({
      moduleId: 'jobs',
      route: '/pipeline',
      expiresAt: new Date(Date.now() - 1000),
    });
    expect(await isShareTokenActive(tokenId)).toBe(false);
  });
});
```

- [ ] **Step 3: Move integration tests under a dedicated directory**

The vitest config from Task 1.4 has `test:integration` pointed at `tests/integration`. Move the integration test file:

```bash
mkdir -p tests/integration
git mv lib/shared/share-links.integration.test.ts tests/integration/share-links.test.ts
```

Update imports inside the moved file to use `@/lib/shared/...` paths:

```ts
import { db } from '@/lib/shared/db';
import { shareLinks } from '@/platform/db/schema';
import {
  createShareLink,
  revokeShareLink,
  isShareTokenActive,
  verifyShareToken,
} from '@/lib/shared/share-links';
```

- [ ] **Step 4: Run integration test**

Ensure migrations have been applied to the Neon dev branch, then run integration tests (vitest reads `DATABASE_URL` from `.env.local` via the dotenv load wired into `vitest.setup.ts`):

```bash
pnpm db:migrate
pnpm test:integration
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/share-links.ts tests/integration/share-links.test.ts
git commit -m "feat: add share-link DB ops (create/revoke/list/isActive) with integration tests"
```

## Task 7.3: `/share/[token]` entry route

**Files:**
- Create: `app/share/[token]/page.tsx`, `app/share/[token]/not-found.tsx`
- Modify: `lib/shared/auth.ts` (add helper for share-scope plumbing)

The share route verifies the token, then renders the target module route in guest mode. We achieve this by importing the module's route component directly inside the share route.

- [ ] **Step 1: Add a `redirectToShare` helper**

Append to `lib/shared/share-links.ts`:

```ts
import { verifyShareToken as _verify } from './share-links';

export async function resolveShareToken(token: string) {
  const secret = process.env.SHARE_LINK_SIGNING_KEY;
  if (!secret) throw new Error('SHARE_LINK_SIGNING_KEY is not set');
  const payload = _verify(token, secret);
  if (!payload) return null;
  if (!(await isShareTokenActive(payload.tokenId))) return null;
  return payload;
}
```

(Adjust the imports so there's only one `verifyShareToken` exported — leave the top-level export and reference it locally.) If the helper above causes a naming conflict, inline `_verify` as a local rename.

- [ ] **Step 2: Write `app/share/[token]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { resolveShareToken } from '@/lib/shared/share-links';
import { ModuleErrorBoundary } from '@/components/shell/boundaries/ModuleErrorBoundary';
import { renderSharedModuleRoute } from '@/lib/shared/share-render';

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const payload = await resolveShareToken(token);
  if (!payload) notFound();

  return (
    <main className="min-h-screen bg-white p-6">
      <div className="mb-4 rounded bg-slate-100 px-3 py-2 text-xs text-slate-700">
        You are viewing a shared, read-only page.
      </div>
      <ModuleErrorBoundary moduleName={payload.moduleId}>
        {await renderSharedModuleRoute(payload.moduleId, payload.route, payload.tokenId)}
      </ModuleErrorBoundary>
    </main>
  );
}
```

- [ ] **Step 3: Write `lib/shared/share-render.ts`**

```ts
import 'server-only';
import * as path from 'node:path';
import { getModuleById } from './registry';
import { notFound } from 'next/navigation';

export async function renderSharedModuleRoute(moduleId: string, route: string, tokenId: string) {
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();

  const routeDef = mod.config.routes.find((r) => r.path === route);
  if (!routeDef || !routeDef.shareable) notFound();

  const componentPath = path.join(mod.dir, routeDef.component);
  const imported = (await import(/* @vite-ignore */ componentPath)) as {
    default: (props: { shareScope: { moduleId: string; route: string; tokenId: string } }) => Promise<JSX.Element> | JSX.Element;
  };

  const shareScope = { moduleId, route, tokenId };
  return imported.default({ shareScope });
}
```

Note: dynamic imports of module components at runtime require Next's bundler to keep them in the build. We'll address this with a static manifest of importable components in Phase 9. For now, this works in dev; in prod we'll generate static imports.

- [ ] **Step 4: Write `app/share/[token]/not-found.tsx`**

```tsx
export default function ShareNotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">Link not available</h1>
        <p className="mt-2 text-sm text-slate-600">
          This share link is invalid, expired, or has been revoked.
        </p>
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Update proxy to block writes from share-token requests**

Edit `proxy.ts` — add a write-block for `/share/*` subrequests if such routes ever existed (defense-in-depth):

```ts
// Add inside proxy(), before the auth check:
if (pathname.startsWith('/share/') && req.method !== 'GET' && req.method !== 'HEAD') {
  return new NextResponse('Forbidden', { status: 403 });
}
```

- [ ] **Step 6: Commit**

```bash
git add app/share lib/shared/share-render.ts lib/shared/share-links.ts proxy.ts
git commit -m "feat: add /share/[token] entry route with read-only module rendering"
```

## Task 7.4: Share-link admin UI

**Files:**
- Create: `app/(shell)/admin/share-links/page.tsx`, `app/(shell)/admin/share-links/actions.ts`

- [ ] **Step 1: Write `app/(shell)/admin/share-links/actions.ts`**

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { createShareLink, revokeShareLink, listShareLinks } from '@/lib/shared/share-links';
import { getModules } from '@/lib/shared/registry';

export async function createLinkAction(formData: FormData) {
  const moduleId = String(formData.get('moduleId') ?? '');
  const route = String(formData.get('route') ?? '');
  const label = String(formData.get('label') ?? '') || undefined;
  const expiresInDaysRaw = String(formData.get('expiresInDays') ?? '');
  const expiresInDays = expiresInDaysRaw ? Number(expiresInDaysRaw) : NaN;

  const modules = await getModules();
  const mod = modules.find((m) => m.config.id === moduleId);
  if (!mod) throw new Error(`Unknown module ${moduleId}`);
  const routeDef = mod.config.routes.find((r) => r.path === route);
  if (!routeDef || !routeDef.shareable) {
    throw new Error(`Route ${route} on module ${moduleId} is not shareable`);
  }

  const expiresAt =
    Number.isFinite(expiresInDays) && expiresInDays > 0
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
      : undefined;

  await createShareLink({ moduleId, route, label, expiresAt });
  revalidatePath('/admin/share-links');
}

export async function revokeLinkAction(formData: FormData) {
  const tokenId = String(formData.get('tokenId') ?? '');
  if (!tokenId) return;
  await revokeShareLink(tokenId);
  revalidatePath('/admin/share-links');
}

export async function getShareableRoutes() {
  const modules = await getModules();
  const out: { moduleId: string; route: string; label: string }[] = [];
  for (const m of modules) {
    for (const r of m.config.routes) {
      if (r.shareable) out.push({ moduleId: m.config.id, route: r.path, label: `${m.config.name} ${r.path}` });
    }
  }
  return out;
}

export { listShareLinks };
```

- [ ] **Step 2: Write `app/(shell)/admin/share-links/page.tsx`**

```tsx
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createLinkAction,
  revokeLinkAction,
  getShareableRoutes,
  listShareLinks,
} from './actions';

export default async function ShareLinksPage() {
  const [routes, links] = await Promise.all([getShareableRoutes(), listShareLinks()]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Share Links</h1>

      <section>
        <h2 className="mb-2 text-lg font-medium">Create</h2>
        {routes.length === 0 ? (
          <p className="text-sm text-slate-500">No shareable routes available.</p>
        ) : (
          <form action={createLinkAction} className="space-y-3 max-w-md">
            <div>
              <Label htmlFor="moduleRoute">Route</Label>
              <select
                name="route-selector"
                id="moduleRoute"
                className="w-full rounded border px-2 py-1.5 text-sm"
                onChange={(e) => {
                  const [moduleId, ...rest] = e.target.value.split('|');
                  const form = e.target.form!;
                  (form.elements.namedItem('moduleId') as HTMLInputElement).value = moduleId ?? '';
                  (form.elements.namedItem('route') as HTMLInputElement).value = rest.join('|');
                }}
                defaultValue={`${routes[0]!.moduleId}|${routes[0]!.route}`}
              >
                {routes.map((r) => (
                  <option key={`${r.moduleId}|${r.route}`} value={`${r.moduleId}|${r.route}`}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input type="hidden" name="moduleId" defaultValue={routes[0]!.moduleId} />
              <input type="hidden" name="route" defaultValue={routes[0]!.route} />
            </div>
            <div>
              <Label htmlFor="label">Label (optional)</Label>
              <Input id="label" name="label" />
            </div>
            <div>
              <Label htmlFor="expiresInDays">Expires in (days, blank for never)</Label>
              <Input id="expiresInDays" name="expiresInDays" type="number" min={1} />
            </div>
            <Button type="submit">Create link</Button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Active links</h2>
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">No active links.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {links.map((l) => (
              <li key={l.id} className="rounded border p-3">
                <div className="font-mono text-xs">{l.id}</div>
                <div>{l.moduleId} {l.route}</div>
                {l.label && <div className="text-slate-500">{l.label}</div>}
                {l.expiresAt && (
                  <div className="text-slate-500">Expires {l.expiresAt.toISOString()}</div>
                )}
                <form action={revokeLinkAction} className="mt-2">
                  <input type="hidden" name="tokenId" value={l.id} />
                  <Button type="submit" variant="outline" size="sm">
                    Revoke
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
```

The inline `onChange` on a server component will fail — make this a small client component instead. Refactor as follows:

- [ ] **Step 3: Extract the create form into a client component**

Create `app/(shell)/admin/share-links/CreateForm.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createLinkAction } from './actions';

type Route = { moduleId: string; route: string; label: string };

export function CreateForm({ routes }: { routes: Route[] }) {
  const [selected, setSelected] = useState(`${routes[0]!.moduleId}|${routes[0]!.route}`);
  const [moduleId, route] = selected.split('|');

  return (
    <form action={createLinkAction} className="space-y-3 max-w-md">
      <div>
        <Label>Route</Label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="w-full rounded border px-2 py-1.5 text-sm"
        >
          {routes.map((r) => (
            <option key={`${r.moduleId}|${r.route}`} value={`${r.moduleId}|${r.route}`}>
              {r.label}
            </option>
          ))}
        </select>
        <input type="hidden" name="moduleId" value={moduleId} />
        <input type="hidden" name="route" value={route ?? ''} />
      </div>
      <div>
        <Label htmlFor="label">Label (optional)</Label>
        <Input id="label" name="label" />
      </div>
      <div>
        <Label htmlFor="expiresInDays">Expires in (days, blank for never)</Label>
        <Input id="expiresInDays" name="expiresInDays" type="number" min={1} />
      </div>
      <Button type="submit">Create link</Button>
    </form>
  );
}
```

Then replace the inline form in `page.tsx` with `<CreateForm routes={routes} />`.

- [ ] **Step 4: Verify in browser**

Boot dev server. Visit `/admin/share-links`. Expected: page renders. If no modules have shareable routes (true at this point), the "Create" section says "No shareable routes available."

- [ ] **Step 5: Commit**

```bash
git add app/\(shell\)/admin/share-links/
git commit -m "feat: add admin UI for creating and revoking share links"
```

---

## Checkpoint 7 — Share links: end-to-end create, visit, revoke

**Stop here. Do not start Phase 8 until every item below passes.**

**Note:** At this point we still have no modules with `shareable: true` routes, so the admin "Create" form will say "No shareable routes available." To fully exercise the share flow you'll need a module — that's done in Phase 11. For now, verify the slice we have here.

**Testing suite:**

```bash
# Unit tests
pnpm test:run lib/shared/share-links.test.ts
# Expected: all signing/verification tests pass

# Integration tests
DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard" pnpm test:integration
# Expected: every integration test passes (share-links scenarios green)

pnpm lint && pnpm typecheck && pnpm test:run
pnpm build
```

**Manual verification:**

1. `pnpm dev`, sign in, visit `/admin/share-links`. Expected: page renders. "Create" section shows "No shareable routes available." "Active links" shows "No active links."
2. Visit `/share/garbage-token`. Expected: the "Link not available" not-found page (NOT the login page — the middleware exempts `/share/*`).

**What this verifies:** share-link signing/verification/revocation works at the unit and DB layers, and the admin UI is wired. The end-to-end flow gets a full smoke test in Phase 11.

---

# Phase 8: Home widget grid

react-grid-layout with persistence in `platform.widget_layouts`.

## Task 8.1: Install dependencies and write widget registry helper

**Files:**
- Create: `lib/shared/widgets.ts`, `lib/shared/widgets.test.ts`

- [ ] **Step 1: Install react-grid-layout + react-resizable types**

```bash
pnpm add react-grid-layout
pnpm add -D @types/react-grid-layout
```

- [ ] **Step 2: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { buildDefaultLayout } from './widgets';
import type { LoadedModule } from './module-loader';

function mod(id: string, widgets: { id: string; defaultSize: { w: number; h: number } }[]): LoadedModule {
  return {
    dir: `/x/${id}`,
    config: {
      id,
      name: id,
      version: '0.0.1',
      description: '',
      enabled: true,
      icon: 'Box',
      nav: { label: id, order: 0 },
      routes: [],
      api: [],
      widgets: widgets.map((w) => ({
        ...w,
        name: w.id,
        minSize: { w: 1, h: 1 },
        component: `widgets/${w.id}`,
      })),
      db: { schema: id.replace(/-/g, '_') },
      cron: [],
      env: { required: [], optional: [] },
    },
  } as LoadedModule;
}

describe('buildDefaultLayout', () => {
  it('places widgets in declaration order with default sizes', () => {
    const modules = [
      mod('jobs', [
        { id: 'a', defaultSize: { w: 4, h: 2 } },
        { id: 'b', defaultSize: { w: 4, h: 2 } },
      ]),
    ];
    const layout = buildDefaultLayout(modules, 12);
    expect(layout).toEqual([
      { moduleId: 'jobs', widgetId: 'a', enabled: true, x: 0, y: 0, w: 4, h: 2 },
      { moduleId: 'jobs', widgetId: 'b', enabled: true, x: 4, y: 0, w: 4, h: 2 },
    ]);
  });

  it('wraps to the next row when the next widget would overflow', () => {
    const modules = [
      mod('jobs', [
        { id: 'a', defaultSize: { w: 8, h: 2 } },
        { id: 'b', defaultSize: { w: 6, h: 2 } },
      ]),
    ];
    const layout = buildDefaultLayout(modules, 12);
    expect(layout[1]).toEqual({
      moduleId: 'jobs',
      widgetId: 'b',
      enabled: true,
      x: 0,
      y: 2,
      w: 6,
      h: 2,
    });
  });
});
```

- [ ] **Step 3: Run (FAIL)**

```bash
pnpm test:run lib/shared/widgets.test.ts
```

- [ ] **Step 4: Implement `lib/shared/widgets.ts`**

```ts
import type { LoadedModule } from './module-loader';
import type { WidgetLayoutEntry } from '@/platform/db/schema';

export function buildDefaultLayout(
  modules: LoadedModule[],
  columns: number,
): WidgetLayoutEntry[] {
  const layout: WidgetLayoutEntry[] = [];
  let x = 0;
  let y = 0;
  let rowH = 0;

  for (const m of modules) {
    for (const w of m.config.widgets) {
      if (x + w.defaultSize.w > columns) {
        x = 0;
        y += rowH;
        rowH = 0;
      }
      layout.push({
        moduleId: m.config.id,
        widgetId: w.id,
        enabled: true,
        x,
        y,
        w: w.defaultSize.w,
        h: w.defaultSize.h,
      });
      x += w.defaultSize.w;
      rowH = Math.max(rowH, w.defaultSize.h);
    }
  }

  return layout;
}
```

- [ ] **Step 5: Run (PASS)**

```bash
pnpm test:run lib/shared/widgets.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add lib/shared/widgets.ts lib/shared/widgets.test.ts
git commit -m "feat: add default widget layout builder"
```

## Task 8.2: Layout persistence & loading

**Files:**
- Create: `lib/shared/widget-layout-store.ts`
- Create: `tests/integration/widget-layout-store.test.ts`

- [ ] **Step 1: Implement `lib/shared/widget-layout-store.ts`**

```ts
import { db } from './db';
import { widgetLayouts, type WidgetLayoutEntry } from '@/platform/db/schema';
import { eq } from 'drizzle-orm';

const SINGLETON_ID = 'singleton';

export async function loadLayout(): Promise<WidgetLayoutEntry[] | null> {
  const rows = await db.select().from(widgetLayouts).where(eq(widgetLayouts.id, SINGLETON_ID));
  return rows[0]?.layout ?? null;
}

export async function saveLayout(layout: WidgetLayoutEntry[]): Promise<void> {
  await db
    .insert(widgetLayouts)
    .values({ id: SINGLETON_ID, layout })
    .onConflictDoUpdate({
      target: widgetLayouts.id,
      set: { layout, updatedAt: new Date() },
    });
}
```

- [ ] **Step 2: Write integration test**

`tests/integration/widget-layout-store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/lib/shared/db';
import { widgetLayouts } from '@/platform/db/schema';
import { loadLayout, saveLayout } from '@/lib/shared/widget-layout-store';

beforeEach(async () => {
  await db.delete(widgetLayouts);
});

describe('widget layout store', () => {
  it('returns null when nothing saved', async () => {
    expect(await loadLayout()).toBeNull();
  });

  it('round-trips a layout', async () => {
    const layout = [
      { moduleId: 'jobs', widgetId: 'a', enabled: true, x: 0, y: 0, w: 4, h: 2 },
    ];
    await saveLayout(layout);
    expect(await loadLayout()).toEqual(layout);
  });

  it('overwrites on subsequent saves', async () => {
    await saveLayout([
      { moduleId: 'jobs', widgetId: 'a', enabled: true, x: 0, y: 0, w: 4, h: 2 },
    ]);
    await saveLayout([
      { moduleId: 'jobs', widgetId: 'b', enabled: true, x: 0, y: 0, w: 6, h: 2 },
    ]);
    const result = await loadLayout();
    expect(result).toHaveLength(1);
    expect(result![0]!.widgetId).toBe('b');
  });
});
```

- [ ] **Step 3: Run integration tests**

```bash
DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard" pnpm test:integration
```

Expected: all integration tests pass (share-links + widget-layout-store).

- [ ] **Step 4: Commit**

```bash
git add lib/shared/widget-layout-store.ts tests/integration/widget-layout-store.test.ts
git commit -m "feat: add widget layout load/save store with integration tests"
```

## Task 8.3: Home page widget grid client component

**Files:**
- Modify: `app/(shell)/page.tsx`
- Create: `app/(shell)/HomeGrid.tsx`, `app/(shell)/save-layout-action.ts`

- [ ] **Step 1: Write `app/(shell)/save-layout-action.ts`**

```ts
'use server';

import { saveLayout } from '@/lib/shared/widget-layout-store';
import type { WidgetLayoutEntry } from '@/platform/db/schema';

export async function saveLayoutAction(layout: WidgetLayoutEntry[]) {
  await saveLayout(layout);
}
```

- [ ] **Step 2: Write `app/(shell)/HomeGrid.tsx`**

```tsx
'use client';

import { useState } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { WidgetErrorBoundary } from '@/components/shell/boundaries/WidgetErrorBoundary';
import type { WidgetLayoutEntry } from '@/platform/db/schema';
import { saveLayoutAction } from './save-layout-action';

type Props = {
  initialLayout: WidgetLayoutEntry[];
  widgets: Record<string, React.ReactNode>; // keyed by `${moduleId}:${widgetId}`
};

export function HomeGrid({ initialLayout, widgets }: Props) {
  const [layout, setLayout] = useState(initialLayout);
  const gridLayout = layout
    .filter((l) => l.enabled)
    .map((l) => ({
      i: `${l.moduleId}:${l.widgetId}`,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    }));

  return (
    <GridLayout
      className="layout"
      cols={12}
      rowHeight={80}
      width={1100}
      layout={gridLayout}
      onLayoutChange={(next) => {
        const merged: WidgetLayoutEntry[] = layout.map((entry) => {
          const found = next.find((n) => n.i === `${entry.moduleId}:${entry.widgetId}`);
          if (!found) return entry;
          return { ...entry, x: found.x, y: found.y, w: found.w, h: found.h };
        });
        setLayout(merged);
        void saveLayoutAction(merged);
      }}
    >
      {gridLayout.map((g) => {
        const node = widgets[g.i];
        return (
          <div key={g.i} className="overflow-hidden rounded border bg-white">
            <WidgetErrorBoundary widgetName={g.i}>{node ?? null}</WidgetErrorBoundary>
          </div>
        );
      })}
    </GridLayout>
  );
}
```

- [ ] **Step 3: Write `lib/shared/widget-render.ts`**

```ts
import 'server-only';
import * as path from 'node:path';
import { getModules } from './registry';
import type { ReactNode } from 'react';

export async function renderAllWidgets(): Promise<Record<string, ReactNode>> {
  const modules = await getModules();
  const out: Record<string, ReactNode> = {};
  for (const m of modules) {
    for (const w of m.config.widgets) {
      const componentPath = path.join(m.dir, w.component);
      try {
        const mod = (await import(/* @vite-ignore */ componentPath)) as {
          default: () => Promise<ReactNode> | ReactNode;
        };
        out[`${m.config.id}:${w.id}`] = await mod.default();
      } catch (err) {
        console.error(`Widget ${m.config.id}:${w.id} failed to render`, err);
      }
    }
  }
  return out;
}
```

- [ ] **Step 4: Update `app/(shell)/page.tsx`**

```tsx
import { getModules } from '@/lib/shared/registry';
import { loadLayout } from '@/lib/shared/widget-layout-store';
import { buildDefaultLayout } from '@/lib/shared/widgets';
import { renderAllWidgets } from '@/lib/shared/widget-render';
import { HomeGrid } from './HomeGrid';

export default async function HomePage() {
  const modules = await getModules();
  const persisted = await loadLayout();
  const layout = persisted ?? buildDefaultLayout(modules, 12);
  const widgets = await renderAllWidgets();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Home</h1>
      <HomeGrid initialLayout={layout} widgets={widgets} />
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add app/\(shell\)/ lib/shared/widget-render.ts
git commit -m "feat: add draggable resizable widget grid on home page"
```

---

## Checkpoint 8 — Home widget grid renders (empty) and persists

**Stop here. Do not start Phase 9 until every item below passes.**

**Testing suite:**

```bash
pnpm test:run lib/shared/widgets.test.ts
# Expected: layout builder tests pass

DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard" pnpm test:integration
# Expected: widget-layout-store integration tests pass

pnpm lint && pnpm typecheck && pnpm test:run
pnpm build
```

**Manual verification:**

1. `pnpm dev`, sign in. Visit `/`. Expected: home renders without errors; the grid container is empty (no modules yet) — no widgets displayed.
2. `docker exec -i dashboard-postgres psql -U dashboard -d dashboard -c "SELECT * FROM platform.widget_layouts;"` — likely empty row at this point; that's correct because there are no widgets to lay out.

**What this verifies:** react-grid-layout is wired, layout persistence round-trips, and the home page composes correctly even with zero widgets. Full draggable behavior gets exercised in Phase 11 when the smoke module adds a real widget.

---

# Phase 9: Cron aggregation

A build-time script reads all module manifests and writes their cron entries into `vercel.json`.

## Task 9.1: TDD cron aggregator

**Files:**
- Create: `scripts/build-vercel-config.ts`, `scripts/build-vercel-config.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { buildVercelConfig } from './build-vercel-config';
import type { LoadedModule } from '@/lib/shared/module-loader';

function mod(id: string, cron: { schedule: string; handler: string }[]): LoadedModule {
  return {
    dir: `/x/${id}`,
    config: {
      id,
      name: id,
      version: '0.0.1',
      description: '',
      enabled: true,
      icon: 'Box',
      nav: { label: id, order: 0 },
      routes: [],
      api: [],
      widgets: [],
      db: { schema: id.replace(/-/g, '_') },
      cron,
      env: { required: [], optional: [] },
    },
  } as LoadedModule;
}

describe('buildVercelConfig', () => {
  it('aggregates cron entries from all modules', () => {
    const result = buildVercelConfig([
      mod('jobs', [{ schedule: '0 9 * * 1', handler: '/api/jobs/cron/digest' }]),
      mod('reading', [{ schedule: '0 0 * * *', handler: '/api/reading/cron/daily' }]),
    ]);
    expect(result.crons).toEqual([
      { path: '/api/jobs/cron/digest', schedule: '0 9 * * 1' },
      { path: '/api/reading/cron/daily', schedule: '0 0 * * *' },
    ]);
  });

  it('omits crons key when no module has crons', () => {
    const result = buildVercelConfig([mod('jobs', [])]);
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run (FAIL)**

```bash
pnpm test:run scripts/build-vercel-config.test.ts
```

- [ ] **Step 3: Implement `scripts/build-vercel-config.ts`**

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { discoverModules, type LoadedModule } from '../lib/shared/module-loader';

export function buildVercelConfig(modules: LoadedModule[]): Record<string, unknown> {
  const crons = modules.flatMap((m) =>
    m.config.cron.map((c) => ({ path: c.handler, schedule: c.schedule })),
  );
  return crons.length > 0 ? { crons } : {};
}

async function main() {
  const root = process.cwd();
  const modules = await discoverModules(root);
  const enabled = modules.filter((m) => m.config.enabled);
  const config = buildVercelConfig(enabled);

  const outPath = path.join(root, 'vercel.json');
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await fs.readFile(outPath, 'utf-8'));
  } catch {}
  const merged = { ...existing, ...config };
  await fs.writeFile(outPath, JSON.stringify(merged, null, 2) + '\n');
  console.log(`Wrote ${outPath} with ${(config.crons as unknown[] | undefined)?.length ?? 0} cron entries`);
}

if (require.main === module) {
  void main();
}
```

- [ ] **Step 4: Add script entry**

In `package.json`:

```json
{
  "scripts": {
    "build:vercel-config": "tsx scripts/build-vercel-config.ts",
    "prebuild": "pnpm build:vercel-config"
  }
}
```

```bash
pnpm add -D tsx
```

- [ ] **Step 5: Run tests (PASS)**

```bash
pnpm test:run scripts/build-vercel-config.test.ts
```

- [ ] **Step 6: Verify build hook runs**

```bash
pnpm build
```

Expected: `vercel.json` is written (likely empty `{}` since no modules yet). Build completes.

- [ ] **Step 7: Commit**

```bash
git add scripts/ package.json
git commit -m "feat: aggregate module cron entries into vercel.json at build time"
```

---

## Checkpoint 9 — Cron aggregator emits vercel.json correctly

**Stop here. Do not start Phase 10 until every item below passes.**

**Testing suite:**

```bash
pnpm test:run scripts/build-vercel-config.test.ts
# Expected: 2 tests pass

pnpm build:vercel-config
cat vercel.json
# Expected: valid JSON. With no modules, content is "{}\n"

pnpm build
# Expected: prebuild ran, vercel.json regenerated, full build succeeded
```

**Manual verification:**

1. Open `vercel.json`. Confirm the file exists and is valid JSON.

**What this verifies:** the build-time cron aggregation script is wired into `prebuild`, runs cleanly with no modules, and produces a valid `vercel.json` skeleton.

---

# Phase 10: Module scaffolding

`_template/` folder and `pnpm new-module` CLI.

## Task 10.1: Create `modules/_template/`

**Files:**
- Create: `modules/_template/module.config.ts.template`, `modules/_template/routes/index.tsx.template`, `modules/_template/widgets/Placeholder.tsx.template`, `modules/_template/lib/queries.ts.template`, `modules/_template/lib/queries.test.ts.template`, `modules/_template/api/health.ts.template`, `modules/_template/db/schema.ts.template`, `modules/_template/README.md.template`

Each `.template` file has placeholders `{{ID}}`, `{{NAME}}`, `{{ICON}}`, `{{DESCRIPTION}}`, `{{SCHEMA}}`.

- [ ] **Step 1: `modules/_template/module.config.ts.template`**

```ts
import type { ModuleConfig } from '@/lib/shared/types';

export default {
  id: '{{ID}}',
  name: '{{NAME}}',
  version: '0.1.0',
  description: '{{DESCRIPTION}}',
  enabled: true,
  icon: '{{ICON}}',
  nav: { label: '{{NAME}}', order: 100 },
  routes: [
    { path: '/', component: 'routes/index', shareable: false },
  ],
  api: [
    { path: '/health', methods: ['GET'] },
  ],
  widgets: [],
  db: { schema: '{{SCHEMA}}' },
  cron: [],
  env: { required: [], optional: [] },
} satisfies ModuleConfig;
```

- [ ] **Step 2: `modules/_template/routes/index.tsx.template`**

```tsx
export default function {{NAME_PASCAL}}IndexPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{{NAME}}</h1>
      <p className="text-sm text-slate-600">Module scaffold — replace with real content.</p>
    </div>
  );
}
```

- [ ] **Step 3: `modules/_template/api/health.ts.template`**

```ts
import { withErrorHandler } from '@/lib/shared/with-error-handler';

export const GET = withErrorHandler('{{ID}}', async () => {
  return Response.json({ status: 'ok', module: '{{ID}}' });
});
```

- [ ] **Step 4: `modules/_template/lib/queries.ts.template`**

```ts
import 'server-only';
// Module-private logic lives here. Keep this file pure and TDD-tested.

export function ping(): string {
  return 'pong-{{ID}}';
}
```

- [ ] **Step 5: `modules/_template/lib/queries.test.ts.template`**

```ts
import { describe, it, expect } from 'vitest';
import { ping } from './queries';

describe('{{ID}} queries', () => {
  it('returns the module-tagged ping', () => {
    expect(ping()).toBe('pong-{{ID}}');
  });
});
```

- [ ] **Step 6: `modules/_template/db/schema.ts.template`**

```ts
import { pgSchema, uuid, text, timestamp } from 'drizzle-orm/pg-core';

export const {{SCHEMA_CAMEL}} = pgSchema('{{SCHEMA}}');

// Add tables here, e.g.:
// export const items = {{SCHEMA_CAMEL}}.table('items', {
//   id: uuid('id').primaryKey().defaultRandom(),
//   createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
// });

// Placeholder kept so generated migrations have something. Delete and add real tables.
export const _placeholder = {{SCHEMA_CAMEL}}.table('_placeholder', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
```

- [ ] **Step 7: `modules/_template/widgets/Placeholder.tsx.template`**

```tsx
export default function {{NAME_PASCAL}}Placeholder() {
  return <div className="p-3 text-sm">{{NAME}} widget</div>;
}
```

- [ ] **Step 8: `modules/_template/README.md.template`**

```md
# {{NAME}} ({{ID}})

{{DESCRIPTION}}

## Files

- `module.config.ts` — manifest
- `routes/` — pages mounted at `/{{ID}}/*`
- `api/` — API handlers mounted at `/api/{{ID}}/*`
- `lib/` — module-private logic (TDD-strict, ≥80% coverage)
- `db/` — Drizzle schema + migrations
- `widgets/` — home-page widgets owned by this module
- `tests/` — integration tests
```

- [ ] **Step 9: Commit**

```bash
git add modules/_template/
git commit -m "feat: add module scaffolding template"
```

## Task 10.2: `pnpm new-module` CLI

**Files:**
- Create: `scripts/new-module.ts`, `scripts/new-module.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest';
import { renderTemplate, scaffoldModule } from './new-module';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

describe('renderTemplate', () => {
  it('substitutes placeholders', () => {
    const out = renderTemplate('id={{ID}} name={{NAME}} pascal={{NAME_PASCAL}} schema={{SCHEMA}} camel={{SCHEMA_CAMEL}} icon={{ICON}} desc={{DESCRIPTION}}', {
      id: 'job-tracker',
      name: 'Job Tracker',
      icon: 'Briefcase',
      description: 'Tracks jobs',
    });
    expect(out).toBe(
      'id=job-tracker name=Job Tracker pascal=JobTracker schema=job_tracker camel=jobTracker icon=Briefcase desc=Tracks jobs',
    );
  });
});

describe('scaffoldModule', () => {
  it('creates a working module folder from the template', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scaffold-'));
    fs.mkdirSync(path.join(tmp, 'modules', '_template'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'modules', '_template', 'README.md.template'),
      '# {{NAME}}',
    );
    fs.mkdirSync(path.join(tmp, 'modules', '_template', 'routes'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'modules', '_template', 'routes', 'index.tsx.template'),
      'export default function {{NAME_PASCAL}}(){return null}',
    );

    await scaffoldModule(tmp, {
      id: 'demo',
      name: 'Demo',
      icon: 'Box',
      description: 'A demo',
    });

    const generated = fs.readFileSync(
      path.join(tmp, 'modules', 'demo', 'README.md'),
      'utf-8',
    );
    expect(generated).toBe('# Demo');

    const route = fs.readFileSync(
      path.join(tmp, 'modules', 'demo', 'routes', 'index.tsx'),
      'utf-8',
    );
    expect(route).toContain('function Demo(');
    fs.rmSync(tmp, { recursive: true });
  });
});
```

- [ ] **Step 2: Run (FAIL)**

```bash
pnpm test:run scripts/new-module.test.ts
```

- [ ] **Step 3: Implement `scripts/new-module.ts`**

```ts
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as readline from 'node:readline/promises';

export type ScaffoldInput = {
  id: string;
  name: string;
  icon: string;
  description: string;
};

export function renderTemplate(template: string, input: ScaffoldInput): string {
  const schema = input.id.replace(/-/g, '_');
  const namePascal = input.name.replace(/[^A-Za-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
  const schemaCamel = schema
    .split('_')
    .map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1)))
    .join('');

  return template
    .replace(/\{\{ID\}\}/g, input.id)
    .replace(/\{\{NAME\}\}/g, input.name)
    .replace(/\{\{NAME_PASCAL\}\}/g, namePascal)
    .replace(/\{\{SCHEMA\}\}/g, schema)
    .replace(/\{\{SCHEMA_CAMEL\}\}/g, schemaCamel)
    .replace(/\{\{ICON\}\}/g, input.icon)
    .replace(/\{\{DESCRIPTION\}\}/g, input.description);
}

export async function scaffoldModule(rootDir: string, input: ScaffoldInput): Promise<void> {
  if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(input.id)) {
    throw new Error(`Invalid id "${input.id}" — must be kebab-case`);
  }
  const templateDir = path.join(rootDir, 'modules', '_template');
  const targetDir = path.join(rootDir, 'modules', input.id);

  try {
    await fs.access(targetDir);
    throw new Error(`Target directory already exists: ${targetDir}`);
  } catch (err: any) {
    if (err?.code !== 'ENOENT' && !err.message?.startsWith('Target')) throw err;
    if (err.message?.startsWith('Target')) throw err;
  }

  async function copy(srcDir: string, dstDir: string) {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await fs.mkdir(dstDir, { recursive: true });
    for (const e of entries) {
      const src = path.join(srcDir, e.name);
      if (e.isDirectory()) {
        await copy(src, path.join(dstDir, e.name));
      } else {
        const targetName = e.name.replace(/\.template$/, '');
        const content = await fs.readFile(src, 'utf-8');
        const rendered = e.name.endsWith('.template') ? renderTemplate(content, input) : content;
        await fs.writeFile(path.join(dstDir, targetName), rendered);
      }
    }
  }

  await copy(templateDir, targetDir);
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const idArg = process.argv[2];
  const id = idArg ?? (await rl.question('Module id (kebab-case): '));
  const name = await rl.question(`Display name (default: ${id}): `).then((s) => s.trim() || id);
  const icon = await rl.question('Lucide icon name (default: Package): ').then((s) => s.trim() || 'Package');
  const description = await rl.question('Description: ');
  rl.close();
  await scaffoldModule(process.cwd(), { id, name, icon, description });
  console.log(`Created modules/${id}`);
}

if (require.main === module) {
  void main();
}
```

- [ ] **Step 4: Add npm script**

In `package.json`:

```json
{
  "scripts": {
    "new-module": "tsx scripts/new-module.ts"
  }
}
```

- [ ] **Step 5: Run tests (PASS)**

```bash
pnpm test:run scripts/new-module.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add scripts/new-module.ts scripts/new-module.test.ts package.json
git commit -m "feat: add pnpm new-module CLI for scaffolding modules"
```

---

## Checkpoint 10 — `pnpm new-module` produces a valid scaffold

**Stop here. Do not start Phase 11 until every item below passes.**

**Testing suite:**

```bash
pnpm test:run scripts/new-module.test.ts
# Expected: 2 tests pass

# Dry-run scaffold a throwaway module to verify the real CLI works
pnpm new-module scratch-mod <<EOF
Scratch Module
Box
Throwaway for checkpoint verification
EOF

ls modules/scratch-mod/
# Expected: module.config.ts, routes/, api/, lib/, db/, widgets/, README.md present

cat modules/scratch-mod/module.config.ts
# Expected: id is scratch-mod, schema is scratch_mod, name is "Scratch Module"

pnpm test:run modules/scratch-mod/lib/queries.test.ts
# Expected: 1 test passes (the placeholder ping test)

# Clean up the throwaway module
rm -rf modules/scratch-mod
```

**Manual verification:**

1. Confirm `modules/_template/` still exists (the cleanup above only removed `scratch-mod`).

**What this verifies:** the scaffolding template and CLI produce a structurally valid module that the loader will accept and whose placeholder tests pass.

---

# Phase 11: End-to-end smoke module

A trivial `modules/_smoke/` that exercises every extension point: a route, an API, a widget, and a cron stub. Confirms the whole platform composes correctly before any real module is built.

Note the leading underscore would normally skip discovery — we'll temporarily name it `smoke` (no underscore) so the loader picks it up, then we'll add a way to disable it via `enabled: false` after smoke is done.

## Task 11.1: Generate the smoke module

**Files:**
- Created by `pnpm new-module`: `modules/smoke/*`

- [ ] **Step 1: Generate**

```bash
echo -e "Smoke Test\nBox\nValidates the platform end-to-end\n" | pnpm new-module smoke
```

(If interactive prompts misbehave, supply args directly in the script invocation.)

- [ ] **Step 2: Add a widget to the manifest**

Edit `modules/smoke/module.config.ts`. Replace `widgets: []` with:

```ts
widgets: [
  {
    id: 'hello',
    name: 'Smoke Hello',
    defaultSize: { w: 4, h: 2 },
    minSize: { w: 2, h: 1 },
    component: 'widgets/Placeholder',
  },
],
```

- [ ] **Step 3: Add a cron entry**

Append to the manifest's `cron: []`:

```ts
cron: [
  { schedule: '0 0 1 1 *', handler: '/api/smoke/cron/yearly' },
],
```

Create `modules/smoke/api/cron.yearly.ts`:

```ts
import { withErrorHandler } from '@/lib/shared/with-error-handler';

export const GET = withErrorHandler('smoke', async () => {
  return Response.json({ ran: true });
});
```

- [ ] **Step 4: Generate and run module's migration**

```bash
pnpm db:generate
pnpm db:migrate
```

- [ ] **Step 5: Wire up route mounting**

Next.js doesn't auto-mount `modules/<id>/routes/*` — we need shim files under `app/(shell)/[moduleId]/`. Create the dynamic mount.

Create `app/(shell)/[moduleId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { getModuleById } from '@/lib/shared/registry';
import { ModuleErrorBoundary } from '@/components/shell/boundaries/ModuleErrorBoundary';
import * as path from 'node:path';

export default async function ModuleRootPage({ params }: { params: Promise<{ moduleId: string }> }) {
  const { moduleId } = await params;
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();
  const route = mod.config.routes.find((r) => r.path === '/');
  if (!route) notFound();
  const componentPath = path.join(mod.dir, route.component);
  const imported = (await import(/* @vite-ignore */ componentPath)) as { default: () => Promise<JSX.Element> | JSX.Element };
  return (
    <ModuleErrorBoundary moduleName={mod.config.name}>
      {await imported.default()}
    </ModuleErrorBoundary>
  );
}
```

Similarly, create `app/(shell)/[moduleId]/[...rest]/page.tsx` to handle deeper routes — it walks `params.rest`, matches against `mod.config.routes`, and renders.

```tsx
import { notFound } from 'next/navigation';
import { getModuleById } from '@/lib/shared/registry';
import { ModuleErrorBoundary } from '@/components/shell/boundaries/ModuleErrorBoundary';
import * as path from 'node:path';

export default async function ModuleNestedPage({
  params,
}: {
  params: Promise<{ moduleId: string; rest: string[] }>;
}) {
  const { moduleId, rest } = await params;
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();
  const fullPath = '/' + rest.join('/');
  const route = mod.config.routes.find((r) => r.path === fullPath);
  if (!route) notFound();
  const componentPath = path.join(mod.dir, route.component);
  const imported = (await import(/* @vite-ignore */ componentPath)) as { default: () => Promise<JSX.Element> | JSX.Element };
  return (
    <ModuleErrorBoundary moduleName={mod.config.name}>
      {await imported.default()}
    </ModuleErrorBoundary>
  );
}
```

- [ ] **Step 6: Wire up API mounting**

Create `app/api/[moduleId]/[...rest]/route.ts`:

```ts
import { notFound } from 'next/navigation';
import { getModuleById } from '@/lib/shared/registry';
import * as path from 'node:path';

async function handle(method: string, moduleId: string, rest: string[], req: Request) {
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();
  const handlerName = rest.length === 0 ? 'index' : rest.join('.');
  const handlerPath = path.join(mod.dir, 'api', handlerName);
  let imported: Record<string, (req: Request) => Promise<Response>>;
  try {
    imported = (await import(/* @vite-ignore */ handlerPath)) as never;
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const fn = imported[method];
  if (!fn) return new Response('Method not allowed', { status: 405 });
  return fn(req);
}

type RouteCtx = { params: Promise<{ moduleId: string; rest: string[] }> };

export const GET = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('GET', moduleId, rest, req);
};
export const POST = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('POST', moduleId, rest, req);
};
export const PATCH = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('PATCH', moduleId, rest, req);
};
export const PUT = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('PUT', moduleId, rest, req);
};
export const DELETE = async (req: Request, ctx: RouteCtx) => {
  const { moduleId, rest } = await ctx.params;
  return handle('DELETE', moduleId, rest, req);
};
```

- [ ] **Step 7: Boot the dev server and check smoke module surfaces**

```bash
pnpm dev
```

Manual checks:
- Sidebar shows "Smoke Test"
- `/smoke` renders the placeholder page
- `/api/smoke/health` returns `{"status":"ok","module":"smoke"}`
- Home page shows a "Smoke Hello" widget
- Module unit test runs: `pnpm test:run modules/smoke/lib/queries.test.ts`

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add end-to-end smoke module + dynamic route and API mounts"
```

## Task 11.2: Playwright smoke test

**Files:**
- Create: `tests/e2e/platform-smoke.spec.ts`

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from '@playwright/test';

test.describe('platform smoke', () => {
  test('login redirects to home and sidebar shows the smoke module', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.getByLabel('Password').fill(process.env.DASHBOARD_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('link', { name: 'Smoke Test' })).toBeVisible();
  });

  test('module page renders', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Password').fill(process.env.DASHBOARD_PASSWORD!);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.goto('/smoke');
    await expect(page.getByRole('heading', { name: 'Smoke Test' })).toBeVisible();
  });

  test('module API health returns ok', async ({ request }) => {
    // The /api routes are protected by middleware too; we exempt /api/health globally.
    // For this smoke, the test just hits a public module API behind auth — log in first.
    const ctx = await request.newContext();
    const login = await ctx.post('/login', {
      form: { password: process.env.DASHBOARD_PASSWORD! },
    });
    expect(login.status()).toBeLessThan(400);
    const res = await ctx.get('/api/smoke/health');
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });
});
```

- [ ] **Step 2: Run Playwright**

```bash
DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard" pnpm test:e2e
```

Expected: 3 tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/platform-smoke.spec.ts
git commit -m "test: add Playwright E2E smoke covering login, module page, and module API"
```

---

## Checkpoint 11 — Smoke module exercises every extension point end-to-end

**This is the big integration gate. Stop here. Do not start Phase 12 until every item below passes.**

**Testing suite:**

```bash
# 1. All tests
pnpm lint && pnpm typecheck && pnpm test:run
pnpm test:integration

# 2. Playwright E2E
pnpm db:migrate
pnpm test:e2e
# Expected: all 3 platform-smoke tests pass
# (DATABASE_URL etc. come from .env.local pointing at the Neon dev branch.)

# 3. Build sees the smoke module's cron in vercel.json
pnpm build
cat vercel.json
# Expected: crons array includes { "path": "/api/smoke/cron/yearly", "schedule": "0 0 1 1 *" }
```

**Manual verification (golden path through every extension point):**

1. `pnpm dev`, sign in.
2. **Sidebar:** "Smoke Test" appears.
3. **Module page:** click "Smoke Test" — `/smoke` renders the placeholder page with the module name as heading.
4. **Module API:** `curl -b "<cookie>" http://localhost:3000/api/smoke/health` returns `{"status":"ok","module":"smoke"}`. (Easiest: open DevTools → Network on `/smoke`, copy cookie header.)
5. **Widget on home:** visit `/`. "Smoke Hello" widget appears in the grid. Drag it; resize it. Refresh the page — layout persists in the new position.
6. **Share link flow:** Visit `/admin/share-links`. There still aren't shareable routes for the smoke module (its routes have `shareable: false` by default) — verify the "no shareable routes" state instead. If you want to test the full flow, temporarily edit `modules/smoke/module.config.ts` to set `shareable: { mode: 'read-only' }` on the `/` route, create a share link, open it in an incognito window, confirm read-only banner is visible, then revoke the link and undo the manifest edit.
7. **Error boundary:** temporarily throw an error inside `modules/smoke/routes/index.tsx`'s default export. Reload `/smoke` — module boundary fallback appears; the rest of the dashboard (sidebar, home) still works. Revert.

**What this verifies:** the platform composes end-to-end. Every extension point in the module contract (route, API, widget, cron, error boundary, manifest validation, sidebar registration) functions as designed. The platform is ready to host real feature modules.

---

# Phase 12: CI & deploy

GitHub Actions, Vercel config sanity check.

## Task 12.1: GitHub Actions workflow

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm lint
      - run: pnpm typecheck

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:coverage

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: dashboard
          POSTGRES_PASSWORD: dashboard
          POSTGRES_DB: dashboard
        ports: ['5432:5432']
        options: >-
          --health-cmd="pg_isready -U dashboard"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=10
    env:
      DATABASE_URL: postgres://dashboard:dashboard@localhost:5432/dashboard
      DASHBOARD_PASSWORD: ci-password
      SHARE_LINK_SIGNING_KEY: ${{ secrets.CI_SHARE_KEY || '00000000000000000000000000000000000000000000000000000000000000aa' }}
      SESSION_COOKIE_SECRET: ${{ secrets.CI_SESSION_KEY || '00000000000000000000000000000000000000000000000000000000000000bb' }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm db:migrate
      - run: pnpm test:integration

  build:
    runs-on: ubuntu-latest
    needs: [lint-and-typecheck, unit-tests]
    env:
      DATABASE_URL: postgres://placeholder
      DASHBOARD_PASSWORD: ci
      SHARE_LINK_SIGNING_KEY: ${{ secrets.CI_SHARE_KEY || '00000000000000000000000000000000000000000000000000000000000000aa' }}
      SESSION_COOKIE_SECRET: ${{ secrets.CI_SESSION_KEY || '00000000000000000000000000000000000000000000000000000000000000bb' }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm build

  e2e:
    runs-on: ubuntu-latest
    needs: [build]
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: dashboard
          POSTGRES_PASSWORD: dashboard
          POSTGRES_DB: dashboard
        ports: ['5432:5432']
        options: >-
          --health-cmd="pg_isready -U dashboard"
          --health-interval=5s
          --health-timeout=3s
          --health-retries=10
    env:
      DATABASE_URL: postgres://dashboard:dashboard@localhost:5432/dashboard
      DASHBOARD_PASSWORD: ci-password
      SHARE_LINK_SIGNING_KEY: ${{ secrets.CI_SHARE_KEY || '00000000000000000000000000000000000000000000000000000000000000aa' }}
      SESSION_COOKIE_SECRET: ${{ secrets.CI_SESSION_KEY || '00000000000000000000000000000000000000000000000000000000000000bb' }}
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm db:migrate
      - run: pnpm test:e2e
```

- [ ] **Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflow for lint, unit, integration, build, and E2E"
```

## Task 12.2: README + final docs sweep

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` with concrete project documentation**

```md
# Personal Dashboard

A modular personal dashboard hosted on Vercel.

## Quick start

```bash
pnpm install
cp .env.example .env.local
# Edit .env.local: paste your Neon dev-branch connection string into DATABASE_URL,
# generate 32-byte hex values for SHARE_LINK_SIGNING_KEY and SESSION_COOKIE_SECRET,
# set a real DASHBOARD_PASSWORD.
pnpm db:migrate
pnpm dev
```

Visit http://localhost:3000 — sign in with the password from `.env.local`.

## Adding a module

```bash
pnpm new-module <module-id>
```

See `CLAUDE.md` for the platform contract.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm test` | Run unit tests (watch) |
| `pnpm test:run` | Run unit tests once |
| `pnpm test:coverage` | Run unit tests with coverage |
| `pnpm test:integration` | Run integration tests against the Neon dev branch |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm lint` | Lint |
| `pnpm typecheck` | TypeScript type check |
| `pnpm format` | Format with Prettier |
| `pnpm db:migrate` | Run all migrations against `DATABASE_URL` |
| `pnpm db:generate` | Generate new migration from schema diff |
| `pnpm db:studio` | Open Drizzle Studio against `DATABASE_URL` |
| `pnpm new-module` | Scaffold a new module |
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: replace README with project quick-start and command reference"
```

---

## Checkpoint 12 — CI is green on a real PR

**Final checkpoint. Do not consider the platform "done" until this passes.**

**Testing suite:**

```bash
# 1. Local everything-green
pnpm lint && pnpm typecheck && pnpm test:run
DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard" pnpm test:integration
DATABASE_URL="postgres://dashboard:dashboard@localhost:5432/dashboard" pnpm test:e2e
pnpm build

# 2. Push a branch and observe CI
git checkout -b platform-bootstrap
git push -u origin platform-bootstrap

# 3. Open the PR (or just push directly to main if branch protection isn't set up yet)
gh pr create --title "Platform bootstrap" --body "Implements the platform per docs/superpowers/plans/2026-05-21-modular-dashboard-platform.md"

# 4. Wait for CI
gh pr checks --watch
# Expected: all 5 jobs (lint-and-typecheck, unit-tests, integration-tests, build, e2e) green
```

**Manual verification:**

1. On GitHub, open the PR and confirm all 5 checks display green.
2. Click into the e2e job logs and skim — confirm Playwright actually ran the smoke tests (not skipped).
3. Confirm GitHub branch protection on `main` requires PRs and passing checks (Settings → Branches).

**What this verifies:** the platform is shippable. CI catches what should be caught, the deploy pipeline works, and Kevin has the gates he needs before changes hit `main`.

---

## Self-Review (already performed by writer)

- Spec coverage: every spec section has at least one task. Auth (Phase 4), share links (Phase 7), module loader (Phase 3), error handling (Phase 6), dev workflow (Phase 10), CI (Phase 12), home grid (Phase 8), cron (Phase 9), and smoke validation (Phase 11) are all covered.
- Placeholder scan: no "TBD" or "implement later" — every step has concrete code or commands. The single deferred concern is the dynamic-import pattern (Task 7.3 / 11.1), which is acknowledged inline as needing a static-imports refinement if turbopack/webpack hot-reload boundaries cause issues in prod; the implementor should evaluate during smoke testing.
- Type consistency: `Session`, `ShareScope`, `ModuleConfig`, `WidgetLayoutEntry`, `LoadedModule` are defined once and reused consistently. `withErrorHandler('module-id', handler)` signature is consistent across the wrapper definition and template usage.

## What this plan does NOT build

- The Job Tracker module (its own spec + plan cycle)
- File storage (Vercel Blob) — deferred per spec
- Sentry / external error tracking — deferred per spec
- Email — deferred per spec
- Multi-user accounts — explicitly out of scope forever
- Cross-module event bus — deferred to v2 per spec

After this plan ships, the next cycle is:
1. Brainstorm the Job Tracker module spec
2. Write the Job Tracker module implementation plan
3. Build it, validating that the platform contract holds
