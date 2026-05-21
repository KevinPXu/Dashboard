# Modular Personal Dashboard — Platform Design Spec

**Date:** 2026-05-21
**Status:** In progress (brainstorming session; updated incrementally)
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
│   ├── middleware.ts
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

## 12. Open Sections **[in progress / pending]**

- **Section 4 (of design narrative): Error handling strategy** — module-level error boundaries, error UI, logging conventions, how a crashed module affects the shell
- **Section 5 (of design narrative): Module dev workflow** — `pnpm new-module` mechanics, local DB setup, seed data conventions, hot reload behavior
- **Section 6 (of design narrative): Deployment & CI** — branch model, preview deploys, GitHub Actions specifics, migration deploy order in practice

These will be filled in as brainstorming continues. This document will be updated in place.

---

## 13. After This Spec

1. Spec self-review (placeholders, contradictions, ambiguity)
2. User reviews and approves
3. Invoke `superpowers:writing-plans` to produce an implementation plan
4. Implementation plan executed via `superpowers:executing-plans` or `superpowers:test-driven-development`
5. First module (Job Tracker) gets its own spec + plan as a separate cycle
