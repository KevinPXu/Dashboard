# Modular Personal Dashboard — Platform Design Spec

**Date:** 2026-05-21
**Status:** Complete pending user review
**Author:** Kevin + Claude (collaborative brainstorm)

---

## 0. Document Status

This spec is being written incrementally during the brainstorming session so that decisions persist if the session is interrupted. Sections marked **[locked in]** are agreed. Sections marked **[in progress]** or **[pending]** are not yet final.

Companion document: `CLAUDE.md` at the repo root, which captures the same principles in a form intended to guide Claude across future sessions.

---

## 1. Goal & Scope

Build a personal dashboard, deployed on Vercel, that serves as Kevin's daily-use control center. The first concrete feature is a **job application tracker**, but the dashboard must be designed as a *platform* on which arbitrary modules (expense tracker, reading list, habit tracker, etc.) can be developed and toggled independently.

### In scope
- Single-user dashboard (Kevin only)
- Read-only share links for specific pages
- Modular architecture with strict isolation between modules
- Test-driven development as a first-class discipline
- One Vercel deployment, one shared Postgres database
- First module: Job Tracker (designed in a separate spec)

### Explicitly out of scope (forever, unless re-evaluated)
- Multi-user accounts / invitations / ACLs
- Separately deployed module microservices
- Native mobile apps (responsive web only)

### Deferred (may be added later)
- Email sending
- Realtime / WebSockets
- Redis / external caching
- Sentry / external error tracking
- File storage (Vercel Blob) — until a module requires it

---

## 2. Architectural Principles **[locked in]**

1. One Next.js app, modular internally. "Microservice" means *logically isolated module within one app*, not a separately deployed process.
2. Strict module isolation. No cross-module imports except via another module's `lib/public-api.ts` (read-only queries).
3. Schema-per-module in Postgres. Each module owns a Postgres schema; no module touches another's tables.
4. Platform tables (`platform.*`) are read/written only by `lib/shared/*` helpers.
5. Manifest-driven discovery at build time. No runtime plugin loading.
6. TDD on logic, ≥80% coverage on `lib/`.
7. YAGNI ruthlessly.
8. Build-time validation over runtime errors.

---

## 3. Tech Stack **[locked in]**

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict mode) |
| Database | Neon Postgres |
| ORM | Drizzle |
| Auth | Custom single-password + signed session cookie |
| Share links | HMAC-signed tokens, stored in `platform.share_links` |
| Styling | Tailwind + shadcn/ui + Radix + Lucide |
| Widget layout | `react-grid-layout` with persistence |
| Testing | Vitest + Playwright |
| Cron | Vercel Cron (aggregated from module manifests into `vercel.json`) |
| Error tracking | Vercel logs only (Sentry deferred) |
| Package manager | pnpm |
| Lint | ESLint + Prettier + custom cross-module-import ban rule |

---

## 4. Repository Layout **[locked in]**

```
Dashboard/
├── CLAUDE.md
├── app/
│   ├── layout.tsx
│   ├── page.tsx                 ← home widget grid
│   ├── login/
│   ├── share/[token]/
│   ├── admin/
│   └── (modules)/               ← dynamic mount for module routes
├── modules/
│   ├── _template/
│   └── <module-id>/
│       ├── module.config.ts
│       ├── routes/
│       ├── api/
│       ├── components/
│       ├── lib/
│       │   ├── public-api.ts
│       │   └── *.ts
│       ├── db/
│       │   ├── schema.ts
│       │   └── migrations/
│       ├── widgets/
│       ├── tests/
│       └── README.md
├── lib/shared/
│   ├── auth.ts
│   ├── db.ts
│   ├── share-links.ts
│   ├── cron.ts
│   ├── proxy.ts                 ← Next 16+ proxy convention (was middleware.ts)
│   ├── module-loader.ts
│   └── types.ts
├── platform/db/
│   ├── schema.ts
│   └── migrations/
├── scripts/new-module.ts
├── tests/e2e/
├── vercel.json
├── drizzle.config.ts
└── package.json
```

---

## 5. Module Contract **[locked in]**

### 5.1 Manifest

Every module exports `module.config.ts` satisfying the `ModuleConfig` type. Full example:

```ts
import type { ModuleConfig } from '@/lib/shared/types';

export default {
  id: 'job-tracker',
  name: 'Job Tracker',
  version: '0.1.0',
  description: 'Track job applications, interviews, and follow-ups.',
  enabled: true,
  icon: 'Briefcase',
  nav: { label: 'Jobs', order: 10 },
  routes: [
    { path: '/', component: 'routes/index', shareable: false },
    { path: '/pipeline', component: 'routes/pipeline', shareable: { mode: 'read-only' } },
    { path: '/[id]', component: 'routes/detail', shareable: false },
  ],
  api: [
    { path: '/applications', methods: ['GET', 'POST'] },
    { path: '/applications/[id]', methods: ['GET', 'PATCH', 'DELETE'] },
  ],
  widgets: [
    {
      id: 'upcoming-interviews',
      name: 'Upcoming Interviews',
      defaultSize: { w: 4, h: 2 },
      minSize: { w: 3, h: 2 },
      component: 'widgets/UpcomingInterviews',
    },
  ],
  db: { schema: 'job_tracker' },
  cron: [
    { schedule: '0 9 * * 1', handler: '/api/job-tracker/cron/weekly-digest' },
  ],
  env: {
    required: [],
    optional: ['JOB_TRACKER_OPENAI_KEY'],
  },
} satisfies ModuleConfig;
```

### 5.2 Build-time validation

The `module-loader.ts` rejects builds if:
- `id` doesn't match folder name, isn't unique, or isn't kebab-case
- `db.schema` doesn't equal `id.replace(/-/g, '_')`
- Any `component` or `handler` path doesn't resolve
- An ESLint scan finds a cross-module import
- A required env var is missing
- Any cron expression is invalid

### 5.3 Module vs. Widget

- **Module** = full feature with pages, API, DB schema, logic. Accessed via sidebar.
- **Widget** = small home-page card owned by a module. Reads from the module's `lib/`. A module may expose 0, 1, or many widgets.

### 5.4 Isolation enforcement

1. ESLint rule: `import` from `@/modules/<other-id>/` forbidden except `@/modules/<other-id>/lib/public-api`.
2. Drizzle pgSchema scoping: each module's `db/schema.ts` only declares tables in its own pgSchema.
3. Test fixtures: per-module DB schema; no cross-talk.
4. Module loader rejects manifests violating any rule.

---

## 6. Auth & Sharing **[locked in]**

### 6.1 Two roles, ever

| Role | Who | Authority |
|---|---|---|
| `owner` | Kevin (password) | Full read + write |
| `guest` | Holder of a valid share-link token | Read of one specific shared route; writes blocked at middleware |

### 6.2 `getSession()` abstraction

Modules never read the password cookie directly. They call `getSession()` which returns:

```ts
{ role: 'owner' } | { role: 'guest', shareScope: { moduleId, route, tokenId } }
```

For mutations, modules call `await requireOwner()` which throws 403 if `role !== 'owner'`.

### 6.3 Share links

- Per-route opt-in via manifest (`shareable: { mode: 'read-only' }`)
- Token = HMAC-signed payload `{ moduleId, route, tokenId, exp? }`
- Recorded in `platform.share_links`; revoked by deleting the row
- Validation: HMAC check + DB lookup (so revocation is instant)
- Middleware blocks all non-GET requests for guest sessions
- Modules render with `session.role !== 'owner'` to hide edit UI

---

## 7. Dashboard Shell UX **[locked in]**

### 7.1 Layout

- **Sidebar nav** auto-built from enabled modules' manifests, sorted by `nav.order`
- **Home page** = drag-arrange + resizable widget grid (react-grid-layout)
- **Module pages** are full-canvas; module owns the content area
- **Mobile**: sidebar collapses; widget grid stacks vertically below a breakpoint

### 7.2 Widget grid

- Layout persisted in `platform.widget_layouts` (single-user, so one row)
- User can toggle widgets on/off from `/admin`
- Per-widget min/max size declared in manifest
- Default layout: widgets placed in declaration order from manifests at first launch

### 7.3 Admin surface (`/admin`)

- Module toggles (mirrors `enabled` field; can override per-deploy)
- Share link management (list, create, revoke, set expiry)
- Widget layout reset
- Environment variable status (read-only display of which required vars are set)

---

## 8. Data Flow **[locked in]**

### 8.1 Owner page request

1. Browser GETs `/job-tracker/pipeline`
2. Middleware reads cookie → `getSession()` → owner
3. Module loader resolves route to `modules/job-tracker/routes/pipeline.tsx`
4. RSC renders, calls `modules/job-tracker/lib/queries.ts`
5. Drizzle queries `job_tracker` schema
6. HTML streams back

### 8.2 Owner mutation

1. Browser POSTs `/api/job-tracker/applications`
2. Shim at `app/api/job-tracker/applications/route.ts` re-exports module handler
3. Module handler calls `await requireOwner()`
4. Zod validates body
5. `lib/applications.ts` does the work, Drizzle writes
6. `revalidateTag('job-tracker:applications')`
7. JSON response

### 8.3 Guest share-link request

1. Browser GETs `/share/abc123xyz`
2. `app/share/[token]/page.tsx` verifies HMAC + DB lookup
3. Token payload extracted: `{ moduleId, route, ... }`
4. Session set to `{ role: 'guest', shareScope: {...} }`
5. Internal server-side re-route to `/<moduleId>/<route>`
6. Module renders; `session.role !== 'owner'` hides edits
7. Middleware blocks any non-GET from guest

### 8.4 Cross-module data access

- **Reads**: import from `@/modules/<other>/lib/public-api`
- **Writes**: not supported across modules
- **Events**: deferred to v2 (typed event bus) until two modules actually need it

### 8.5 Caching

- Next.js native caching with per-module tags (`<module-id>:<resource>`)
- Mutations call `revalidateTag(...)` to invalidate

---

## 9. Testing Strategy **[locked in]**

### 9.1 Three tiers

| Tier | Location | Tool | TDD | Coverage gate |
|---|---|---|---|---|
| Unit | `modules/<id>/lib/*.test.ts` | Vitest | Strict TDD | ≥80% of `lib/` |
| Integration | `modules/<id>/tests/integration/*.test.ts` | Vitest + real Postgres | TDD applies | not gated |
| E2E smoke | `tests/e2e/<module>.spec.ts` | Playwright | Written after | not gated |

### 9.2 CI gate

PRs blocked if:
- Any test fails
- Any module's `lib/` coverage < 80%
- Module loader rejects build
- Playwright smoke fails

### 9.3 Test isolation

- Per-test or per-suite schema fixtures
- Transactions that roll back, or per-test schema create/drop
- No shared state between modules' test suites

---

## 10. Platform-Provided Capabilities **[locked in]**

| Capability | v1? | Notes |
|---|---|---|
| Auth (`getSession`, `requireOwner`) | ✅ | `lib/shared/auth.ts` |
| Database client | ✅ | `lib/shared/db.ts` |
| Share links | ✅ | `lib/shared/share-links.ts` + `platform.share_links` |
| Widget layout persistence | ✅ | `platform.widget_layouts` |
| Cron registration | ✅ | Modules declare in manifest; `vercel.json` generated at build |
| Module loader & validation | ✅ | `lib/shared/module-loader.ts` |
| Module scaffolding CLI | ✅ | `pnpm new-module <id>` |
| File storage | ⏸ Deferred | Vercel Blob planned; not needed by job tracker v1 |
| Email | ⏸ Deferred | |
| Realtime | ⏸ Deferred | |
| Redis / external cache | ⏸ Deferred | |
| Error tracking (Sentry) | ⏸ Deferred | Vercel logs only |
| Event bus (cross-module pub/sub) | ⏸ v2 | Build only if a second module demands it |

---

## 11. Conventions **[locked in]**

| Concern | Rule |
|---|---|
| Module ID | `kebab-case` |
| DB schema name | `snake_case`, matches module ID |
| Module env vars | `MODULE_ID_*` (SCREAMING_SNAKE prefix) |
| Platform env vars | unprefixed (`DATABASE_URL`, `DASHBOARD_PASSWORD`, `SHARE_LINK_SIGNING_KEY`) |
| Cache tags | `<module-id>:<resource>` |
| Cron handlers | `/api/<module-id>/cron/<name>` |
| Migrations order | platform first, then modules alphabetically |
| Migrations direction | forward-only |

---

## 12. Error Handling **[locked in]**

### 12.1 UI error boundaries

Three nested layers, provided by `lib/shared/boundaries.tsx` and applied automatically by the shell:

- **Shell-level boundary** — wraps everything as last resort
- **Per-module boundary** — wraps each module's route subtree; a crashed module shows a fallback while the rest of the dashboard keeps working
- **Per-widget boundary** — each home-page widget is independently boundaried so one bad widget doesn't kill the grid

Modules do not write their own boundaries.

### 12.2 Server-side errors

Every API route uses `withErrorHandler('<module-id>', handler)` from `lib/shared/with-error-handler.ts`. Standard responses:

| Status | Cause | Body |
|---|---|---|
| 400 | Zod validation failure | `{ error: 'ValidationError', issues: [...] }` |
| 401 | No valid session | `{ error: 'Unauthorized' }` |
| 403 | Guest write / out-of-scope guest access | `{ error: 'Forbidden' }` |
| 404 | `throw new NotFoundError()` | `{ error: 'NotFound' }` |
| 500 | Unhandled exception | `{ error: 'InternalError' }` (sanitized; full trace logged) |

### 12.3 Logging

- Modules use `lib/shared/logger.ts`, never raw `console.*`
- Emits structured JSON with `{ moduleId, route, timestamp, level }` auto-injected
- Vercel ingests `console` output as logs (no external tracking service in v1)

### 12.4 Cron failures

- Errors logged with full context
- No automatic retry (Vercel Cron default)
- Modules must implement idempotent handlers

---

## 13. Module Dev Workflow **[locked in]**

### 13.1 `pnpm new-module <id>`

Steps:
1. Prompts for `name`, `description`, `icon` (default `Package`)
2. Copies `modules/_template/` to `modules/<id>/` with token substitution (`{{ID}}`, `{{NAME}}`, `{{SCHEMA}}`, etc.)
3. Generates starter Drizzle schema with correct pgSchema and an initial empty migration
4. Generates placeholder route, widget, and unit test
5. Generates `README.md` from template

No central registry. The module loader auto-discovers via filesystem scan.

### 13.2 Local development environment

Local development uses a **Neon Postgres branch** (no local Docker). One project on Neon hosts `main` (prod) and `dev` (local) branches. Local dev points to the `dev` branch via `DATABASE_URL` in `.env.local`. CI uses ephemeral branches via `neonctl`.

| Command | Purpose |
|---|---|
| `pnpm db:migrate` | Run platform + module migrations against `DATABASE_URL` |
| `pnpm db:seed` | Run all modules' `db/seed.ts` (alphabetical) |
| `pnpm db:reset` | Drop all schemas, re-migrate, re-seed (use sparingly on shared branches) |
| `pnpm db:generate` | Generate a new migration from a schema diff |
| `pnpm db:studio` | Open Drizzle Studio against `DATABASE_URL` |
| `pnpm dev` | Next.js dev server |
| `pnpm test` | Vitest watch (unit) |
| `pnpm test:integration` | Vitest integration suite (real DB via `DATABASE_URL`) |
| `pnpm test:e2e` | Playwright smoke against `pnpm dev` |
| `pnpm new-module <id>` | Scaffold a new module |

### 13.3 Seed data convention

- Optional `modules/<id>/db/seed.ts` exports a default async function `(db) => Promise<void>`
- Runs only on explicit `pnpm db:seed` (never on deploy)
- Modules are responsible for idempotent seeds (`ON CONFLICT DO NOTHING` or equivalent)

### 13.4 Hot reload

- Standard Next.js HMR
- Manifest changes re-validate on save; validation errors shown as dev overlays (non-blocking)
- Adding/removing a top-level module folder requires a dev server restart

---

## 14. Deployment & CI **[locked in]**

### 14.1 Branching

- `main` = production, auto-deploys to Vercel
- Feature branches → PR → merge to `main`
- Vercel preview deploys on every push to any non-`main` branch
- No staging branch

### 14.2 CI on PR (`.github/workflows/ci.yml`)

In order, with parallelism where independent:

1. **Lint + typecheck** (parallel) — ESLint (incl. custom cross-module-import ban), Prettier check, `tsc --noEmit`
2. **Module validation** — runs `lib/shared/module-loader.ts` validation
3. **Build** — `pnpm build`
4. **Unit tests + coverage** — `pnpm test --run --coverage`; per-module `lib/` ≥ 80%
5. **Integration tests** — against an ephemeral Neon branch created via `neonctl branch create`, torn down after
6. **E2E smoke** — Playwright against the Vercel preview URL

Branch protection on `main`: PRs required, all checks must pass.

### 14.3 Migration deploy

- Vercel build step runs `pnpm db:migrate` against the target Neon branch
  - Preview deploys → preview Neon branch
  - Production → main Neon branch
- Migrations are forward-only
- Code rollback = Vercel "Promote Previous Deployment" (data migrations must be hand-reversed)

### 14.4 Secrets

- Production + preview env vars live in Vercel project settings
- Local dev uses `.env.local` (gitignored)
- `.env.example` is committed listing every required env var name
- Module loader rejects builds when any required env var is missing

---

## 15. After This Spec

1. Spec self-review (placeholders, contradictions, ambiguity)
2. User reviews and approves
3. Invoke `superpowers:writing-plans` to produce an implementation plan
4. Implementation plan executed via `superpowers:executing-plans` or `superpowers:test-driven-development`
5. First module (Job Tracker) gets its own spec + plan as a separate cycle
