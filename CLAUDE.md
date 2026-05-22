# Personal Dashboard — Platform Principles & Conventions

> **Status:** Living document. Updated continuously during brainstorming and development. Decisions are locked in here so they survive session loss and inform all future work.
>
> **Last updated:** 2026-05-21 (during initial platform brainstorming session)

---

## 1. North Star

A modular personal dashboard hosted on Vercel. Each module is a self-contained feature that can be toggled on/off, developed independently, and tested as a single unit. Modules share one Postgres database but own their own schemas.

The dashboard is **single-user** (Kevin only). Selective read-only sharing of specific pages with outside people is supported via signed share links — but full multi-user is explicitly out of scope, forever.

---

## 1.5 Process Principles (apply to every spec/plan/implementation cycle)

These rules govern *how* Claude works on this project, not what gets built. They take precedence over Claude's default behaviors and over any "auto mode" / bias-toward-action instructions in the harness.

### Testable checkpoints in every plan

When writing an implementation plan in `docs/superpowers/plans/`, the plan **must** be structured around explicit checkpoints that Kevin verifies by hand before the next chunk of work begins.

- **Group tasks into checkpoints.** Every 3–8 tasks (or at every phase boundary, whichever comes first), insert a `## Checkpoint N — <name>` section.
- **Each checkpoint specifies a testing suite.** This is a concrete, copy-pasteable block listing:
  - Commands to run (`pnpm test:run ...`, `pnpm typecheck`, `pnpm dev` + manual browser steps, `curl ...`, etc.)
  - Expected output / behavior for each command
  - A short "What this verifies" sentence so Kevin knows what would be broken if it fails
- **Plans state explicitly: "stop after each checkpoint and wait for human verification."** This is non-negotiable.

### Auto mode is bypassed at checkpoints

Even when "Auto Mode" is active (i.e., Claude is biased toward continuing without stopping), Claude **must** stop at every checkpoint defined in the plan, surface the testing suite, and wait for Kevin's explicit go-ahead before proceeding to the next group of tasks.

If Kevin says "keep going" or "skip the checkpoint," honor that — but never assume it. The default is to pause.

### Implementation execution honors plan checkpoints

When executing a plan (via `superpowers:executing-plans`, `superpowers:subagent-driven-development`, or inline work), Claude:

1. Completes the tasks in the current checkpoint block.
2. Stops and prints the testing-suite block from the plan.
3. Waits for Kevin to confirm the suite passes (or fix and re-run).
4. Only then begins the next checkpoint's tasks.

If Claude finishes a checkpoint and tests fail, **fix the failures within the same checkpoint** — do not advance to the next one with a known-red suite.

### Spec brainstorming uses interactive checkpoints too

When brainstorming a spec, Claude pauses at section boundaries (architecture, module contract, data flow, error handling, etc.) and waits for Kevin's section-by-section approval. Auto mode does not skip these confirmations.

---

## 2. Architectural Principles

These principles override convenience. If a decision conflicts with one of these, the principle wins unless this document is amended.

1. **One Next.js app, modular internally.** Single Vercel deployment. "Microservice" means *logically isolated module within one app*, not a separately deployed process.
2. **Strict module isolation.** No module imports from another module's internals. Modules communicate only through:
   - `lib/shared/*` (platform-provided utilities)
   - Another module's explicit `lib/public-api.ts` (read-only queries)
   - The shared database (each module owns a Postgres schema)
3. **Schema-per-module in Postgres.** Each module owns a Postgres schema named after its `id` (snake_case). Tables live in `<module_id>.*`, never `public.*`. Prevents collisions and makes ownership obvious.
4. **Platform tables are platform-only.** `platform.*` tables (share links, widget layouts, settings) are read/written exclusively through `lib/shared/*` helpers. Modules never touch them.
5. **Manifest-driven discovery.** The shell discovers modules at build time by scanning `modules/*/module.config.ts`. No runtime plugin loading. Toggle off = set `enabled: false` in the manifest (or remove the folder).
6. **TDD on logic.** Every module's `lib/` directory is TDD-developed (red → green → refactor) and must hit ≥80% test coverage. Routes and UI components are not coverage-gated but smoke-tested via Playwright.
7. **YAGNI ruthlessly.** Don't build for hypothetical future modules. If a capability isn't needed by the next module being built, defer it.
8. **The platform fails loudly at build time.** Bad manifests, missing env vars, cross-module imports, invalid cron schedules — all caught before deploy, never at runtime.

---

## 3. Tech Stack (locked in)

| Layer | Choice | Reasoning |
|---|---|---|
| Framework | Next.js 15 (App Router) | Vercel-native, server components, route handlers |
| Language | TypeScript (strict mode) | Type safety across module boundaries |
| Database | Neon Postgres | Vercel-first-party, serverless pooling, branching for tests |
| ORM | Drizzle | TypeScript-first, clean per-schema modeling, lightweight, type-safe queries |
| Auth | Custom single-password + signed session cookie | Single user, no need for OAuth/NextAuth |
| Share links | HMAC-signed tokens stored in `platform.share_links` | Per-route opt-in, revocable, optional expiry |
| Styling | Tailwind CSS + shadcn/ui + Radix primitives + Lucide icons | Standard Next.js stack, copy-paste components |
| Widget layout | `react-grid-layout` with persistence in `platform.widget_layouts` | Drag-arrange + resizable, single-user layout |
| Testing | Vitest (unit + integration), Playwright (E2E smoke) | Standard Vite/Next ecosystem tooling |
| Scheduled jobs | Vercel Cron (declared in `vercel.json`, aggregated from module manifests) | Free, native, no extra infra |
| File storage | **Deferred** until a module needs it (Vercel Blob is the planned choice) | Resume *URLs* suffice for the job tracker in v1 |
| Email / realtime / Redis | **Deferred** | Not needed for v1 |
| Error tracking | Vercel logs + analytics only (Sentry deferred) | Personal-use scope; add Sentry if pain emerges |
| Package manager | pnpm | Fast, disk-efficient |
| Lint/format | ESLint + Prettier, with custom rule banning cross-module imports | Enforces principle #2 |

---

## 4. Repository Layout

```
Dashboard/
├── CLAUDE.md                    ← this document
├── app/                         ← Next.js app router (shell-owned)
│   ├── layout.tsx               ← sidebar + auth gate
│   ├── page.tsx                 ← home (widget grid)
│   ├── login/                   ← password login
│   ├── share/[token]/           ← share-link entry point
│   ├── admin/                   ← share links, module toggles, layout reset
│   └── (modules)/               ← dynamic mount point for module routes
├── modules/                     ← all modules live here
│   ├── _template/               ← scaffolding template for `pnpm new-module`
│   └── <module-id>/             ← one folder per module
│       ├── module.config.ts     ← REQUIRED manifest
│       ├── routes/              ← module pages, mounted at /<id>/*
│       ├── api/                 ← module API handlers, mounted at /api/<id>/*
│       ├── components/          ← module-private UI components
│       ├── lib/                 ← TDD-strict, ≥80% coverage
│       │   ├── public-api.ts    ← read-only queries other modules may import
│       │   └── *.ts
│       ├── db/
│       │   ├── schema.ts        ← Drizzle pgSchema('<module_id>')
│       │   └── migrations/
│       ├── widgets/             ← home-page widget components
│       ├── tests/               ← unit + integration tests
│       └── README.md            ← what it does, how to use it
├── lib/shared/                  ← platform-provided utilities
│   ├── auth.ts                  ← getSession(), requireOwner()
│   ├── db.ts                    ← Drizzle client, schema composition
│   ├── share-links.ts           ← sign / verify / revoke
│   ├── cron.ts                  ← cron registration helper
│   ├── middleware.ts            ← auth gate, guest write-block
│   ├── module-loader.ts         ← discover & validate modules at build time
│   └── types.ts                 ← ModuleConfig type, shared interfaces
├── platform/                    ← platform-owned DB schema & migrations
│   └── db/
│       ├── schema.ts            ← platform.share_links, widget_layouts, settings
│       └── migrations/
├── scripts/
│   └── new-module.ts            ← `pnpm new-module <id>` CLI
├── tests/
│   └── e2e/                     ← Playwright smoke tests
├── vercel.json                  ← cron entries (auto-generated)
├── drizzle.config.ts
└── package.json
```

---

## 5. The Module Contract

### 5.1 Manifest (`module.config.ts`)

Every module exports a default object satisfying `ModuleConfig`:

```ts
export default {
  // Identity
  id: 'job-tracker',                    // kebab-case, matches folder
  name: 'Job Tracker',                  // display name
  version: '0.1.0',
  description: '...',
  enabled: true,                        // toggle on/off
  icon: 'Briefcase',                    // Lucide icon name

  // Navigation
  nav: { label: 'Jobs', order: 10 },

  // Routes mounted at /<id>/*
  routes: [
    { path: '/', component: 'routes/index', shareable: false },
    { path: '/pipeline', component: 'routes/pipeline', shareable: { mode: 'read-only' } },
  ],

  // API handlers mounted at /api/<id>/*
  api: [
    { path: '/applications', methods: ['GET', 'POST'] },
  ],

  // Home-page widgets
  widgets: [
    {
      id: 'upcoming-interviews',
      name: 'Upcoming Interviews',
      defaultSize: { w: 4, h: 2 },
      minSize: { w: 3, h: 2 },
      component: 'widgets/UpcomingInterviews',
    },
  ],

  // Database
  db: { schema: 'job_tracker' },        // matches id with underscores

  // Scheduled jobs
  cron: [
    { schedule: '0 9 * * 1', handler: '/api/job-tracker/cron/weekly-digest' },
  ],

  // Required + optional env vars
  env: {
    required: [],
    optional: ['JOB_TRACKER_OPENAI_KEY'],
  },
} satisfies ModuleConfig;
```

### 5.2 Build-time validation

The module loader rejects builds if any of these fail:
- `id` matches folder name, is unique, is kebab-case
- `db.schema` matches `id` with underscores
- All component / handler paths resolve to real files
- No cross-module imports (ESLint rule)
- All required env vars are present in the environment
- All cron schedules are valid cron expressions

### 5.3 What modules control vs. don't

**Modules control:** their own routes, API endpoints, DB schema (within their pgSchema), widget components, business logic, internal components, internal env vars.

**Modules do NOT control:** sidebar layout, login flow, top-level chrome, share-link UI, widget grid arrangement, platform tables, other modules' data.

### 5.4 Module vs. Widget

- **Module** = full feature. Has pages, API, DB schema, logic. Accessed via sidebar.
- **Widget** = small home-page card owned by a module. Glanceable summary. Clicking deep-links into the module page. A module can have 0, 1, or many widgets. Widgets share the module's `lib/` for queries — one source of truth.

---

## 6. Auth & Sharing Model

### 6.1 Roles (only two, forever)

| Role | Who | Can do |
|---|---|---|
| `owner` | Kevin (password-authenticated) | Everything |
| `guest` | Anyone with a valid share-link token | Read a specific shared route only; all non-GET requests rejected at middleware |

### 6.2 `getSession()` abstraction

Modules never check the password cookie directly. They call:

```ts
const session = await getSession();
// → { role: 'owner' } | { role: 'guest', shareScope: { moduleId, route, tokenId } }
```

For write paths:

```ts
const session = await requireOwner();  // throws 403 if not owner
```

### 6.3 Share links

- Modules opt-in per route via `shareable: { mode: 'read-only' }`
- Owner generates links from `/admin` UI; tokens are HMAC-signed and recorded in `platform.share_links`
- Token payload: `{ moduleId, route, tokenId, exp? }`
- Revocation: delete the `share_links` row (token validity check includes a DB lookup)
- Middleware blocks all non-GET requests from guest sessions automatically
- UI: modules check `session.role !== 'owner'` to hide edit affordances

---

## 7. Testing Strategy

### 7.1 Three tiers

| Tier | Where | Tool | TDD? | Coverage gate |
|---|---|---|---|---|
| Unit | `modules/<id>/lib/*.test.ts` | Vitest | **Strict TDD** (red → green → refactor) | ≥80% on `lib/` |
| Integration | `modules/<id>/tests/integration/*.test.ts` | Vitest + real Postgres (Neon branch or local Docker) | TDD applies | not gated |
| E2E smoke | `tests/e2e/<module>.spec.ts` | Playwright | Written after | not gated |

### 7.2 CI gate

Pull requests are blocked if:
- Any module's unit or integration tests fail
- Any module's `lib/` coverage drops below 80%
- The module loader rejects the build
- Playwright smoke tests fail

### 7.3 Test isolation

- Each module's tests run against an isolated DB schema fixture
- Tests cannot read/write other modules' tables
- Integration tests use transactions that roll back after each test (or per-test schema creation)

---

## 8. Data Flow Summary

| Flow | Path |
|---|---|
| Owner page request | Middleware → auth check → module route component → `lib/` query → Drizzle → HTML stream |
| Owner mutation | Route handler → `requireOwner()` → Zod validation → `lib/` mutation → Drizzle write → revalidateTag |
| Guest share-link request | `/share/[token]` → verify HMAC + DB lookup → set guest session → internal re-route to module → render with `session.role !== 'owner'` (hides edits) |
| Cross-module read | `import { ... } from '@/modules/<other>/lib/public-api'` (the only sanctioned cross-module import) |
| Cross-module write / events | **Not supported in v1.** Deferred typed event bus to v2 only if two modules need it. |

---

## 9. Conventions

### 9.1 Naming

- Module ID: kebab-case (`job-tracker`)
- DB schema: snake_case matching ID (`job_tracker`)
- Env vars: `SCREAMING_SNAKE_CASE` prefixed with module ID (`JOB_TRACKER_API_KEY`); platform vars unprefixed (`DATABASE_URL`, `DASHBOARD_PASSWORD`, `SHARE_LINK_SIGNING_KEY`)
- Cache tags: `<module-id>:<resource>` (`job-tracker:applications`)

### 9.2 Adding a new module

```bash
pnpm new-module <module-id>
```

Generates folder structure, manifest stub, empty test file, README, DB schema stub from `modules/_template/`.

### 9.3 Migrations

- Each module owns its migrations under `modules/<id>/db/migrations/`
- Platform owns its own under `platform/db/migrations/`
- Deploy runs platform migrations first, then each module's migrations in alphabetical module-ID order
- Migrations are forward-only; no automatic rollback

---

## 10. Error Handling

### 10.1 UI error boundaries

Three layers, all provided by `lib/shared/boundaries.tsx` and applied automatically by the shell — modules don't write their own:

- **Shell-level** — last resort, wraps everything
- **Per-module** — wraps each module's route subtree; a crashed module shows a friendly fallback while the rest of the dashboard keeps working
- **Per-widget** — each home-page widget is independently boundaried so one bad widget doesn't kill the grid

### 10.2 Server-side errors

- Every API route is wrapped with `lib/shared/with-error-handler.ts`:
  ```ts
  export const POST = withErrorHandler('job-tracker', async (req) => { ... });
  ```
- Standard responses:
  - `400` — Zod validation failure (`{ error: 'ValidationError', issues: [...] }`)
  - `401` — no session
  - `403` — guest attempting write or out-of-scope access
  - `404` — `new NotFoundError()`
  - `500` — unhandled; sanitized message, full trace logged

### 10.3 Logging

- Modules use `lib/shared/logger.ts`, never raw `console.*`
- `logger.info / warn / error` emit structured JSON with `{ moduleId, route, timestamp, level }` auto-injected
- Vercel ingests `console` output as logs

### 10.4 Cron failures

Logged, no automatic retry. Modules are responsible for idempotent jobs.

---

## 11. Module Dev Workflow

### 11.1 `pnpm new-module <id>`

- Prompts for `name`, `description`, `icon`
- Copies `modules/_template/` → `modules/<id>/` with `{{ID}}` / `{{NAME}}` substitution
- Generates starter Drizzle schema with correct pgSchema and an empty initial migration
- Generates placeholder route, widget, and unit test
- No central registry — auto-discovered by the loader

### 11.2 Local DB

**Local development uses a Neon Postgres branch** (no local Docker / no docker-compose). Rationale: identical engine and connection pattern to production, zero local infra to manage, and Neon's branching makes spinning up isolated test DBs easy.

Setup once:
1. Sign in at https://console.neon.tech
2. Create a project named `personal-dashboard`
3. Create a dev branch (e.g. `dev`) off `main`
4. Copy that branch's connection string into `.env.local` as `DATABASE_URL`

Recommended branch layout:
- `main` (Neon branch) — production
- `dev` (Neon branch) — local development
- Per-test/CI branches created on demand via `neonctl branch create` (CI uses ephemeral branches; local tests can either reuse `dev` or create their own)

| Script | Purpose |
|---|---|
| `pnpm db:migrate` | Run platform then all module migrations against `DATABASE_URL` |
| `pnpm db:seed` | Invoke each module's optional `db/seed.ts` (alphabetical) |
| `pnpm db:reset` | Drop schemas, re-migrate, re-seed (use sparingly on shared branches) |
| `pnpm dev` | Next.js dev server |
| `pnpm test` | Vitest watch |
| `pnpm test:integration` | Vitest integration suite (real DB via `DATABASE_URL`) |
| `pnpm test:e2e` | Playwright smoke tests |

### 11.3 Seed data

- Optional `modules/<id>/db/seed.ts` exports `(db) => Promise<void>`
- Run only when `pnpm db:seed` is explicitly called (never on deploy)
- Modules are responsible for idempotent seeds

### 11.4 Hot reload

Standard Next.js HMR. Manifest changes re-validate on save with non-blocking dev overlay errors. Adding/removing a module folder requires a dev server restart.

---

## 12. Deployment & CI

### 12.1 Branching

- `main` = production (Vercel auto-deploy)
- Feature branches → PR → merge to `main`
- Preview deploys on every non-`main` push

### 12.2 GitHub Actions on PR

`ci.yml` runs:

1. Lint + typecheck (parallel) — ESLint with cross-module ban rule, Prettier, `tsc --noEmit`
2. Module loader validation
3. `pnpm build`
4. Unit tests + coverage (fails if any module's `lib/` < 80%)
5. Integration tests against ephemeral Neon branch
6. Playwright smoke against the Vercel preview URL

Branch protection: PR required on `main`, all checks must pass.

### 12.3 Migrations on deploy

- Vercel build step runs `pnpm db:migrate` against the target Neon branch (preview → preview branch, main → prod branch)
- Forward-only; data-destructive rollbacks must be hand-reversed
- Code rollback = Vercel "Promote Previous Deployment"

### 12.4 Secrets

- Production + preview env vars live in Vercel project settings
- Local dev uses `.env.local` (gitignored)
- `.env.example` is committed with every required variable name listed
- Module loader validates required env vars at build time on Vercel

---

## 13. Open Items (to be filled in by separate brainstorming sessions)

- [ ] First module spec — Job Tracker (its own brainstorm cycle after platform is built)

---

## 14. How to Use This Document

- **Before making a structural change**, read the relevant section here. If your change conflicts with a principle, either change the principle (with reason recorded) or pick a different approach.
- **When adding a new convention**, add it here in the relevant section.
- **When a section becomes stale**, update it. This document is the source of truth.
- **Reference this file from new sessions** so context is preserved across conversations.
