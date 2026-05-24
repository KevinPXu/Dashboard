# Adversarial Review Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the defects surfaced by the 2026-05-23 Codex adversarial review of the platform — five critical, plus the security, build-time-validation, type-safety, data-integrity, migration-ownership, and test-coverage gaps it identified.

**Architecture:** No new subsystems. We tighten existing layers in place:
- Centralize the guest write-block in `lib/shared/proxy.ts` (re-exported from a root `middleware.ts` for Next 15).
- Add a `lib/shared/sessions.ts` helper so shell code stops importing platform tables directly.
- Make the API gateway manifest-aware, bypass-able only via `CRON_SECRET` for declared cron handlers, and require an owner session for everything else.
- Validate every external input that crosses an in/out boundary with Zod (manifest, dynamic module imports, layout JSON read/write, server-action input).
- Split Drizzle into platform vs per-module configs and run platform migrations first then modules alphabetically.
- Cover the dynamic-import path and shared error classes with tests; turn off `passWithNoTests`.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Drizzle + Neon Postgres, Zod, Vitest, ESLint flat config, Vercel Cron.

**Plan structure & checkpoints:** Per `CLAUDE.md` §1.5, this plan groups tasks into checkpoints. **At the end of every checkpoint the agent must STOP, surface the testing suite block verbatim, and wait for Kevin's explicit "passed, continue" before starting the next checkpoint.** Auto Mode does not skip checkpoints.

---

## Phase Map

| Phase | Theme | Tasks | Why first / last |
|---|---|---|---|
| 1 | Critical security & cron auth | 1–6 | These items leak privileges or break production cron; fix before anything else can ship |
| 2 | Build-time validation hardening | 7–12 | Restores the "fail loudly at build time" guarantee in CLAUDE.md §2.8 |
| 3 | Type safety & runtime input validation | 13–17 | Closes the runtime trust-the-cast holes that bypass TypeScript |
| 4 | Migration ownership & shell↔platform boundary | 18–22 | Aligns the repo with the schema-per-module ownership rule |
| 5 | Test coverage gaps | 23–26 | Locks the previous phases in with real tests |

Each task block is sized for 2–5 minutes of work and follows red → green → refactor. Each task ends with a commit.

---

# Phase 1 — Critical security & cron auth

### Task 1: Add `requireOwner()` to share-link Server Actions

The three exported actions in `app/(shell)/admin/share-links/actions.ts` (`createLinkAction`, `revokeLinkAction`, `getShareableRoutes`) and the re-exported `listShareLinks` can be invoked directly by anyone who knows the Server Action endpoint id — they currently rely on page reachability for authorization. Fix by gating every export.

**Files:**
- Modify: `app/(shell)/admin/share-links/actions.ts`
- Test: `app/(shell)/admin/share-links/actions.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// app/(shell)/admin/share-links/actions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shared/auth', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shared/auth')>('@/lib/shared/auth');
  return { ...actual, requireOwner: vi.fn() };
});
vi.mock('@/lib/shared/share-links', () => ({
  createShareLink: vi.fn().mockResolvedValue({ token: 't', tokenId: 'id' }),
  revokeShareLink: vi.fn().mockResolvedValue(undefined),
  listShareLinks: vi.fn().mockResolvedValue([]),
}));
vi.mock('@/lib/shared/registry', () => ({
  getModules: vi.fn().mockResolvedValue([
    {
      config: {
        id: 'm',
        name: 'M',
        routes: [{ path: '/r', component: 'routes/r', shareable: { mode: 'read-only' } }],
      },
    },
  ]),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { requireOwner } from '@/lib/shared/auth';
import {
  createLinkAction,
  revokeLinkAction,
  getShareableRoutes,
  listShareLinks,
} from './actions';

beforeEach(() => vi.clearAllMocks());

describe('share-link server actions', () => {
  it('createLinkAction requires owner', async () => {
    const fd = new FormData();
    fd.set('moduleId', 'm');
    fd.set('route', '/r');
    await createLinkAction(fd);
    expect(requireOwner).toHaveBeenCalledOnce();
  });
  it('revokeLinkAction requires owner', async () => {
    const fd = new FormData();
    fd.set('tokenId', 'id');
    await revokeLinkAction(fd);
    expect(requireOwner).toHaveBeenCalledOnce();
  });
  it('getShareableRoutes requires owner', async () => {
    await getShareableRoutes();
    expect(requireOwner).toHaveBeenCalledOnce();
  });
  it('listShareLinks requires owner', async () => {
    await listShareLinks();
    expect(requireOwner).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run app/\(shell\)/admin/share-links/actions.test.ts`
Expected: 4 failures — `requireOwner` not called.

- [ ] **Step 3: Add the guards**

Edit `app/(shell)/admin/share-links/actions.ts`:

```ts
'use server';

import { revalidatePath } from 'next/cache';
import {
  createShareLink,
  revokeShareLink,
  listShareLinks as _listShareLinks,
} from '@/lib/shared/share-links';
import { getModules } from '@/lib/shared/registry';
import { requireOwner } from '@/lib/shared/auth';

export async function createLinkAction(formData: FormData) {
  await requireOwner();
  // ...existing body unchanged...
}

export async function revokeLinkAction(formData: FormData) {
  await requireOwner();
  // ...existing body unchanged...
}

export async function getShareableRoutes() {
  await requireOwner();
  // ...existing body unchanged...
}

export async function listShareLinks() {
  await requireOwner();
  return _listShareLinks();
}
```

(Replace the bare `export { listShareLinks }` re-export with the wrapper above. Keep every other line of the original body intact.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test:run app/\(shell\)/admin/share-links/actions.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add app/\(shell\)/admin/share-links/actions.ts app/\(shell\)/admin/share-links/actions.test.ts
git commit -m "fix(security): require owner on every share-link Server Action"
```

---

### Task 2: Move shell↔platform DB access behind `lib/shared/sessions.ts`

`app/login/actions.ts` imports the `sessions` table directly from `@/platform/db/schema`. CLAUDE.md §2.4 says platform tables are accessed only through `lib/shared/*` helpers (this includes the shell, not just modules — the shell is platform code, not module code, but the rule is "platform tables are read/written exclusively through `lib/shared/*` helpers"). Add a thin helper.

**Files:**
- Create: `lib/shared/sessions.ts`
- Create: `lib/shared/sessions.test.ts`
- Modify: `app/login/actions.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/shared/sessions.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./db', () => {
  const returning = vi.fn().mockResolvedValue([{ id: 'abc' }]);
  const values = vi.fn(() => ({ returning }));
  const insert = vi.fn(() => ({ values }));
  return { db: { insert } };
});

import { createOwnerSession } from './sessions';
import { db } from './db';

describe('createOwnerSession', () => {
  it('inserts a row and returns its id', async () => {
    const expiresAt = new Date('2099-01-01');
    const out = await createOwnerSession(expiresAt);
    expect(out).toEqual({ id: 'abc' });
    expect(db.insert).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run lib/shared/sessions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the helper**

```ts
// lib/shared/sessions.ts
import 'server-only';
import { db } from './db';
import { sessions } from '@/platform/db/schema';

export async function createOwnerSession(expiresAt: Date): Promise<{ id: string }> {
  const [row] = await db
    .insert(sessions)
    .values({ expiresAt })
    .returning({ id: sessions.id });
  if (!row) throw new Error('Failed to create session row');
  return row;
}
```

- [ ] **Step 4: Switch loginAction to the helper**

Replace the relevant section of `app/login/actions.ts`:

```ts
import { createOwnerSession } from '@/lib/shared/sessions';
// ...remove: import { db } from '@/lib/shared/db';
// ...remove: import { sessions } from '@/platform/db/schema';

// inside loginAction, replace the db.insert(...) block with:
const session = await createOwnerSession(expiresAt).catch(() => null);
if (!session) redirect('/login?error=session');
```

- [ ] **Step 5: Run tests + typecheck**

Run: `pnpm test:run lib/shared/sessions.test.ts && pnpm typecheck`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add lib/shared/sessions.ts lib/shared/sessions.test.ts app/login/actions.ts
git commit -m "refactor(auth): route loginAction through lib/shared/sessions helper"
```

---

### Task 3: Create `lib/shared/proxy.ts` + root `middleware.ts` (guest write-block)

CLAUDE.md §10 promises a centralized "guest write-block": no non-GET request from a guest session reaches a route handler. The file doesn't exist yet. Add it as `lib/shared/proxy.ts` (CLAUDE.md's chosen location, anticipating Next 16's `proxy.ts` rename) and have a minimal Next 15 `middleware.ts` re-export it.

Guest detection: presence of a `dashboard_share` cookie set by the share-token entry route (Task 5 wires it). A request is "guest" if there is no valid owner session **and** a share cookie is present.

**Files:**
- Create: `lib/shared/proxy.ts`
- Create: `lib/shared/proxy.test.ts`
- Create: `middleware.ts` (at repo root)

- [ ] **Step 1: Write the failing test**

```ts
// lib/shared/proxy.test.ts
import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { proxy } from './proxy';

function req(method: string, opts: { ownerCookie?: boolean; shareCookie?: boolean } = {}) {
  const headers = new Headers();
  const cookieParts: string[] = [];
  if (opts.ownerCookie) cookieParts.push('dashboard_session=signed.value');
  if (opts.shareCookie) cookieParts.push('dashboard_share=tok');
  if (cookieParts.length) headers.set('cookie', cookieParts.join('; '));
  return new NextRequest(new Request('http://x/api/foo', { method, headers }));
}

vi.mock('./session-token-edge', () => ({
  verifySessionTokenEdge: vi.fn(async (v: string) => (v === 'signed.value' ? { sid: 's' } : null)),
}));

describe('proxy', () => {
  it('passes through GET from anonymous user', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('GET'));
    expect(res?.status ?? 200).toBe(200);
  });
  it('passes through POST from owner', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('POST', { ownerCookie: true }));
    expect(res?.status ?? 200).toBe(200);
  });
  it('blocks POST from guest (share cookie, no owner)', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('POST', { shareCookie: true }));
    expect(res?.status).toBe(403);
  });
  it('allows GET from guest', async () => {
    process.env.SESSION_COOKIE_SECRET = 'x';
    const res = await proxy(req('GET', { shareCookie: true }));
    expect(res?.status ?? 200).toBe(200);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test:run lib/shared/proxy.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the proxy**

```ts
// lib/shared/proxy.ts
// Runs in the Edge runtime. Do NOT import node:crypto or any 'server-only' code.
import { NextResponse, type NextRequest } from 'next/server';
import { verifySessionTokenEdge } from './session-token-edge';

const SESSION_COOKIE = 'dashboard_session';
const SHARE_COOKIE = 'dashboard_share';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export async function proxy(req: NextRequest): Promise<NextResponse | undefined> {
  if (SAFE_METHODS.has(req.method)) return; // reads are never blocked here

  const sessionCookie = req.cookies.get(SESSION_COOKIE)?.value ?? null;
  const shareCookie = req.cookies.get(SHARE_COOKIE)?.value ?? null;
  if (!shareCookie) return; // not a guest context — let downstream auth decide

  const secret = process.env.SESSION_COOKIE_SECRET;
  if (sessionCookie && secret) {
    const owner = await verifySessionTokenEdge(sessionCookie, secret);
    if (owner) return; // owner with a stale share cookie is still owner
  }

  return new NextResponse('Guest sessions are read-only', { status: 403 });
}
```

- [ ] **Step 4: Wire the root middleware**

```ts
// middleware.ts
export { proxy as middleware } from './lib/shared/proxy';

export const config = {
  // Match every request except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
```

- [ ] **Step 5: Run tests**

Run: `pnpm test:run lib/shared/proxy.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add lib/shared/proxy.ts lib/shared/proxy.test.ts middleware.ts
git commit -m "feat(security): central guest write-block via lib/shared/proxy.ts"
```

---

### Task 4: Make the API gateway cron-aware and manifest-enforced

Two bugs in `app/api/[moduleId]/[...rest]/route.ts`:
1. Every request requires owner — Vercel Cron GETs to `/api/smoke/cron/yearly` return 401, so the cron never runs.
2. Any file under `modules/<id>/api/*` is reachable even if not declared in the manifest's `api` or `cron` list.

Fix both. Cron requests carry `Authorization: Bearer ${CRON_SECRET}`; allow those for paths listed in any module's `cron` entries. Reject any path not in `api` ∪ `cron`.

**Files:**
- Modify: `app/api/[moduleId]/[...rest]/route.ts`
- Modify: `lib/shared/registry.ts` (add `getCronHandlers()` if not present)
- Test: `app/api/[moduleId]/[...rest]/route.test.ts` (new)
- Test: `lib/shared/registry.test.ts` (extend)

- [ ] **Step 1: Inspect what `registry.ts` exposes**

Run: `grep -n "export" lib/shared/registry.ts`
Expected: existing exports include `getModules`, `getModuleById`. You will add `getCronHandlerPaths()`.

- [ ] **Step 2: Write the failing registry test**

```ts
// add to lib/shared/registry.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./module-loader', () => ({
  discoverModules: vi.fn().mockResolvedValue([
    {
      dir: '/x',
      config: {
        id: 'a',
        api: [{ path: '/health', methods: ['GET'] }],
        cron: [{ schedule: '0 0 * * *', handler: '/api/a/cron/daily' }],
        routes: [],
        widgets: [],
        enabled: true,
        name: 'A', version: '0.0.1', description: 'd', icon: 'I',
        nav: { label: 'A', order: 1 }, db: { schema: 'a' },
        env: { required: [], optional: [] },
      },
    },
  ]),
}));

import { getCronHandlerPaths, isApiPathDeclared } from './registry';

describe('registry cron + api enforcement', () => {
  it('lists declared cron handler paths', async () => {
    expect(await getCronHandlerPaths()).toContain('/api/a/cron/daily');
  });
  it('accepts declared api paths', async () => {
    expect(await isApiPathDeclared('a', '/health', 'GET')).toBe(true);
  });
  it('rejects undeclared api paths', async () => {
    expect(await isApiPathDeclared('a', '/secret', 'GET')).toBe(false);
  });
  it('rejects declared path with wrong method', async () => {
    expect(await isApiPathDeclared('a', '/health', 'POST')).toBe(false);
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `pnpm test:run lib/shared/registry.test.ts`
Expected: 4 new failures.

- [ ] **Step 4: Extend `registry.ts`**

Append:

```ts
export async function getCronHandlerPaths(): Promise<string[]> {
  const modules = await getModules();
  return modules.flatMap((m) => m.config.cron.map((c) => c.handler));
}

export async function isApiPathDeclared(
  moduleId: string,
  apiPath: string,
  method: string,
): Promise<boolean> {
  const mod = await getModuleById(moduleId);
  if (!mod) return false;
  return mod.config.api.some(
    (a) => a.path === apiPath && (a.methods as readonly string[]).includes(method),
  );
}
```

- [ ] **Step 5: Run registry tests**

Run: `pnpm test:run lib/shared/registry.test.ts`
Expected: pass.

- [ ] **Step 6: Write the failing gateway test**

```ts
// app/api/[moduleId]/[...rest]/route.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/shared/auth', () => ({
  getSession: vi.fn(),
}));
vi.mock('@/lib/shared/registry', () => ({
  getModuleById: vi.fn().mockResolvedValue({ config: { id: 'smoke' } }),
  getCronHandlerPaths: vi.fn().mockResolvedValue(['/api/smoke/cron/yearly']),
  isApiPathDeclared: vi.fn(),
}));
vi.mock('@/lib/shared/module-import', () => ({
  loadModuleExport: vi.fn().mockResolvedValue({ GET: async () => new Response('ok') }),
}));

import { GET } from './route';
import { getSession } from '@/lib/shared/auth';
import { isApiPathDeclared } from '@/lib/shared/registry';

function ctx(rest: string[]) {
  return { params: Promise.resolve({ moduleId: 'smoke', rest }) };
}

beforeEach(() => {
  vi.mocked(getSession).mockReset();
  vi.mocked(isApiPathDeclared).mockReset();
  process.env.CRON_SECRET = 'crontop';
});

describe('api gateway', () => {
  it('owner can call declared GET /health', async () => {
    vi.mocked(getSession).mockResolvedValue({ role: 'owner' });
    vi.mocked(isApiPathDeclared).mockResolvedValue(true);
    const res = await GET(new Request('http://x/api/smoke/health'), ctx(['health']));
    expect(res.status).toBe(200);
  });
  it('rejects undeclared path even for owner', async () => {
    vi.mocked(getSession).mockResolvedValue({ role: 'owner' });
    vi.mocked(isApiPathDeclared).mockResolvedValue(false);
    const res = await GET(new Request('http://x/api/smoke/secret'), ctx(['secret']));
    expect(res.status).toBe(404);
  });
  it('allows cron call with correct CRON_SECRET, no owner', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const req = new Request('http://x/api/smoke/cron/yearly', {
      headers: { authorization: 'Bearer crontop' },
    });
    const res = await GET(req, ctx(['cron', 'yearly']));
    expect(res.status).toBe(200);
  });
  it('rejects cron call with bad secret', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const req = new Request('http://x/api/smoke/cron/yearly', {
      headers: { authorization: 'Bearer wrong' },
    });
    const res = await GET(req, ctx(['cron', 'yearly']));
    expect(res.status).toBe(401);
  });
  it('rejects unauthenticated non-cron request', async () => {
    vi.mocked(getSession).mockResolvedValue(null);
    const res = await GET(new Request('http://x/api/smoke/health'), ctx(['health']));
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 7: Run to confirm failure**

Run: `pnpm test:run app/api/\[moduleId\]/\[...rest\]/route.test.ts`
Expected: failures across all five.

- [ ] **Step 8: Rewrite the gateway**

Replace `app/api/[moduleId]/[...rest]/route.ts`:

```ts
import { notFound } from 'next/navigation';
import {
  getModuleById,
  getCronHandlerPaths,
  isApiPathDeclared,
} from '@/lib/shared/registry';
import { loadModuleExport } from '@/lib/shared/module-import';
import { getSession } from '@/lib/shared/auth';

async function handle(method: string, moduleId: string, rest: string[], req: Request) {
  const mod = await getModuleById(moduleId);
  if (!mod) notFound();

  const apiPath = '/' + rest.join('/');
  const fullPath = `/api/${moduleId}${apiPath}`;

  // 1) Cron handlers: declared in manifest + verified CRON_SECRET, no owner needed
  const cronPaths = await getCronHandlerPaths();
  if (cronPaths.includes(fullPath)) {
    const expected = process.env.CRON_SECRET;
    const provided = req.headers.get('authorization');
    if (!expected || provided !== `Bearer ${expected}`) {
      return new Response('Unauthorized', { status: 401 });
    }
    // Cron handlers live at api/<...>.ts the same way other handlers do.
  } else {
    // 2) Non-cron: must be declared in manifest AND caller must be owner
    if (!(await isApiPathDeclared(moduleId, apiPath, method))) {
      return new Response('Not found', { status: 404 });
    }
    const session = await getSession();
    if (!session || session.role !== 'owner') {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  const handlerName = rest.length === 0 ? 'index' : rest.join('.');
  let imported: Record<string, unknown>;
  try {
    imported = await loadModuleExport<Record<string, unknown>>(moduleId, `api/${handlerName}`);
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const fn = imported[method];
  if (typeof fn !== 'function') {
    return new Response('Method not allowed', { status: 405 });
  }
  return (fn as (req: Request) => Promise<Response>)(req);
}

type RouteCtx = { params: Promise<{ moduleId: string; rest: string[] }> };
const wrap =
  (method: string) =>
  async (req: Request, ctx: RouteCtx) => {
    const { moduleId, rest } = await ctx.params;
    return handle(method, moduleId, rest, req);
  };

export const GET = wrap('GET');
export const POST = wrap('POST');
export const PATCH = wrap('PATCH');
export const PUT = wrap('PUT');
export const DELETE = wrap('DELETE');
```

- [ ] **Step 9: Add a cron handler file for the smoke module so the manifest matches reality**

```ts
// modules/smoke/api/cron.yearly.ts
export async function GET(_req: Request) {
  return new Response('ok', { status: 200 });
}
```

- [ ] **Step 10: Run gateway tests**

Run: `pnpm test:run app/api/\[moduleId\]/\[...rest\]/route.test.ts`
Expected: 5 passed.

- [ ] **Step 11: Commit**

```bash
git add app/api lib/shared/registry.ts lib/shared/registry.test.ts modules/smoke/api/cron.yearly.ts
git commit -m "fix(api): manifest-enforced dispatch + CRON_SECRET path for cron handlers"
```

---

### Task 5: Establish a guest session on `/share/[token]` routes

`app/share/[token]/page.tsx` resolves the token but never sets a cookie, so a downstream call to `getSession()` returns `null` instead of `{ role: 'guest', shareScope }`. Set a `dashboard_share` cookie scoped to the token id (the same cookie the proxy in Task 3 looks for), and pass the shareScope into `getSession()` for this render.

**Files:**
- Modify: `app/share/[token]/page.tsx`
- Modify: `lib/shared/share-render.ts` (already accepts tokenId; ensures shareScope is propagated)

- [ ] **Step 1: Update the share page to set the cookie + propagate shareScope**

```tsx
// app/share/[token]/page.tsx
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { resolveShareToken } from '@/lib/shared/share-links';
import { ModuleErrorBoundary } from '@/components/shell/boundaries/ModuleErrorBoundary';
import { renderSharedModuleRoute } from '@/lib/shared/share-render';

const SHARE_COOKIE = 'dashboard_share';

type Props = { params: Promise<{ token: string }> };

export default async function SharePage({ params }: Props) {
  const { token } = await params;
  const payload = await resolveShareToken(token);
  if (!payload) notFound();

  const cookieStore = await cookies();
  cookieStore.set(SHARE_COOKIE, payload.tokenId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: payload.exp
      ? Math.max(0, payload.exp - Math.floor(Date.now() / 1000))
      : 60 * 60 * 24,
  });

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

- [ ] **Step 2: Verify `getSession()` returns guest when shareScope is provided**

The existing `getSession()` in `lib/shared/auth.ts` already accepts `(shareScope: ShareScope | null = null)`. Confirm by reading lines 25–40 — no change needed if the signature is intact. If a module calls `getSession()` from within a share render and wants guest semantics, it should call `getSession({ moduleId, route, tokenId })` from the shareScope it received as a prop.

Document this in `lib/shared/share-render.ts` near the call site:

```ts
// shareScope is passed to the module's default export so the module can call
// getSession(shareScope) to receive { role: 'guest', shareScope }. Without
// that argument, getSession() returns null — guest detection relies on the
// 'dashboard_share' cookie set in app/share/[token]/page.tsx for proxy.ts.
```

- [ ] **Step 3: Smoke-test by hand**

Run: `pnpm dev` in another terminal. Open an existing share link or create one via `/admin/share-links`. Visit `/share/<token>`. In dev-tools confirm a `dashboard_share` cookie is set. Open `/api/smoke/health` directly — expect 401 (because guest, no cron, no owner).

- [ ] **Step 4: Commit**

```bash
git add app/share/\[token\]/page.tsx lib/shared/share-render.ts
git commit -m "feat(share): set guest cookie on /share/[token] so proxy can block writes"
```

---

### Task 6: Update `vercel.json` cron entries so Vercel will send `CRON_SECRET`

Vercel's cron runner sends `Authorization: Bearer ${process.env.CRON_SECRET}` automatically once `CRON_SECRET` is set in the project's environment. Document this and add an env check at build time.

**Files:**
- Modify: `lib/shared/env-validator.ts`
- Test: `lib/shared/env-validator.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `lib/shared/env-validator.test.ts`:

```ts
it('requires CRON_SECRET when any module declares cron', () => {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CRON_SECRET;
  expect(() =>
    validatePlatformEnv(env, { cronCount: 1 }),
  ).toThrow(/CRON_SECRET/);
});
it('does not require CRON_SECRET when no module declares cron', () => {
  const env: Record<string, string | undefined> = { ...process.env };
  delete env.CRON_SECRET;
  expect(() => validatePlatformEnv(env, { cronCount: 0 })).not.toThrow();
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/env-validator.test.ts`
Expected: 2 failures (function signature mismatch or missing rule).

- [ ] **Step 3: Extend the validator**

Open `lib/shared/env-validator.ts`, locate `validatePlatformEnv`, and add the rule. The exact diff depends on the current shape — find the function and add:

```ts
export function validatePlatformEnv(
  env: NodeJS.ProcessEnv | Record<string, string | undefined>,
  opts: { cronCount?: number } = {},
): void {
  // ...existing checks...
  if ((opts.cronCount ?? 0) > 0 && !env.CRON_SECRET) {
    throw new Error('CRON_SECRET must be set when any module declares a cron entry');
  }
}
```

Update the prebuild caller in `scripts/build-vercel-config.ts` to pass `cronCount`:

```ts
import { validatePlatformEnv } from '../lib/shared/env-validator';
// after computing `config`:
validatePlatformEnv(process.env, {
  cronCount: (config.crons as unknown[] | undefined)?.length ?? 0,
});
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run lib/shared/env-validator.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/env-validator.ts lib/shared/env-validator.test.ts scripts/build-vercel-config.ts
git commit -m "feat(env): require CRON_SECRET at build time when crons are declared"
```

---

## Checkpoint 1 — Critical security & cron auth

**Stop here. Do not start Phase 2 until every command below passes and Kevin has confirmed.**

```bash
pnpm test:run
pnpm typecheck
pnpm lint
```

Manual smoke (run in two terminals):

```bash
# terminal 1
pnpm dev

# terminal 2
curl -i http://localhost:3000/api/smoke/health
# Expected: HTTP/1.1 401 Unauthorized

# Owner cookie path: log in via /login in a browser, then in the same browser
# visit /api/smoke/health — expected 200 (handler returns ok)

# Cron path: simulate Vercel's call
CRON_SECRET=$(grep -E '^CRON_SECRET=' .env.local | cut -d= -f2-)
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/smoke/cron/yearly
# Expected: HTTP/1.1 200 OK

# Wrong cron secret
curl -i -H "Authorization: Bearer nope" http://localhost:3000/api/smoke/cron/yearly
# Expected: HTTP/1.1 401 Unauthorized

# Undeclared path (logged in or not)
curl -i http://localhost:3000/api/smoke/secret
# Expected: HTTP/1.1 404 Not Found
```

**What this verifies:** All five Critical items in the review are closed — share-link actions are guarded, the proxy exists and blocks guest writes, cron endpoints work via `CRON_SECRET`, the API gateway only dispatches manifest-declared paths, and guest sessions are established on share routes.

---

# Phase 2 — Build-time validation hardening

### Task 7: Stop ignoring ESLint during `next build`

`next.config.ts` currently sets `eslint: { ignoreDuringBuilds: true }`, which means the custom `local/no-cross-module-imports` rule (CLAUDE.md §2.8) never runs on a production build. The original reason was a flat-config compatibility issue resolved in commit `33149ae` (FlatCompat for eslint-config-next). The flag is now obsolete.

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1: Confirm `pnpm lint` succeeds standalone**

Run: `pnpm lint`
Expected: 0 errors (existing CI was green on the last commit).

- [ ] **Step 2: Remove the bypass**

```ts
// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ESLint runs in CI AND during `next build` so cross-module import
  // violations and other lint errors fail deploys.
};

export default nextConfig;
```

- [ ] **Step 3: Verify `pnpm build` still succeeds**

Run: `pnpm build`
Expected: no ESLint errors; build completes.

- [ ] **Step 4: Commit**

```bash
git add next.config.ts
git commit -m "fix(build): re-enable ESLint during next build (fixed in FlatCompat commit)"
```

---

### Task 8: Validate `env.required` for every loaded module at build time

`lib/shared/module-loader.ts:validateModuleStructure` checks routes / widgets / api / cron but ignores `env.required`. CLAUDE.md §5.2 says "All required env vars are present in the environment" is a build-time gate.

**Files:**
- Modify: `lib/shared/module-loader.ts`
- Modify: `lib/shared/module-loader.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/shared/module-loader.test.ts`:

```ts
import { validateModuleStructure } from './module-loader';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';

async function makeTmpModule(id: string) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-'));
  await fs.mkdir(path.join(dir, 'routes'));
  await fs.writeFile(path.join(dir, 'routes', 'index.tsx'), 'export default () => null');
  return dir;
}

it('rejects when env.required is missing from process.env', async () => {
  const dir = await makeTmpModule('x');
  const cfg = {
    id: 'x',
    routes: [{ path: '/', component: 'routes/index', shareable: false as const }],
    api: [], widgets: [], cron: [],
    env: { required: ['X_REQUIRED_KEY'], optional: [] },
  };
  delete process.env.X_REQUIRED_KEY;
  await expect(validateModuleStructure(dir, cfg)).rejects.toThrow(/X_REQUIRED_KEY/);
});

it('accepts when env.required is present', async () => {
  const dir = await makeTmpModule('x');
  const cfg = {
    id: 'x',
    routes: [{ path: '/', component: 'routes/index', shareable: false as const }],
    api: [], widgets: [], cron: [],
    env: { required: ['X_REQUIRED_KEY'], optional: [] },
  };
  process.env.X_REQUIRED_KEY = 'present';
  await expect(validateModuleStructure(dir, cfg)).resolves.toBeUndefined();
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/module-loader.test.ts`
Expected: 1 failure (`env` not checked).

- [ ] **Step 3: Add the check**

Update the `validateModuleStructure` signature to accept `env` and add the loop:

```ts
export async function validateModuleStructure(
  dir: string,
  config: Pick<ModuleConfig, 'id' | 'routes' | 'api' | 'widgets' | 'cron' | 'env'>,
): Promise<void> {
  // ...existing route/widget/api/cron loops unchanged...

  for (const key of config.env.required) {
    if (!process.env[key]) {
      throw new Error(
        `Module "${config.id}" requires env var "${key}" but it is not set`,
      );
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run lib/shared/module-loader.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/module-loader.ts lib/shared/module-loader.test.ts
git commit -m "feat(loader): enforce module env.required at module-load time"
```

---

### Task 9: Tighten the cron-expression validator

`lib/shared/types.ts` accepts `99 99 99 99 99` because each field is checked with a permissive regex with no range check. Add per-field range validation.

**Files:**
- Modify: `lib/shared/types.ts`
- Modify: `lib/shared/types.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/shared/types.test.ts`:

```ts
import { ModuleConfigSchema } from './types';

const base = {
  id: 'm', name: 'M', version: '0.0.1', description: 'd', enabled: true,
  icon: 'I', nav: { label: 'M', order: 1 },
  routes: [], api: [], widgets: [],
  db: { schema: 'm' }, env: { required: [], optional: [] },
};

it('rejects out-of-range cron fields', () => {
  const out = ModuleConfigSchema.safeParse({
    ...base,
    cron: [{ schedule: '99 99 99 99 99', handler: '/api/m/cron' }],
  });
  expect(out.success).toBe(false);
});
it('accepts a valid cron expression', () => {
  const out = ModuleConfigSchema.safeParse({
    ...base,
    cron: [{ schedule: '0 9 * * 1', handler: '/api/m/cron' }],
  });
  expect(out.success).toBe(true);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/types.test.ts`
Expected: 1 failure — `99 99 99 99 99` is currently accepted.

- [ ] **Step 3: Replace the cron refinement**

Replace the `CronExpression` definition in `lib/shared/types.ts`:

```ts
const FIELD_RANGES: Array<[number, number]> = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day-of-month
  [1, 12], // month
  [0, 7],  // day-of-week (0 and 7 both = Sunday)
];

function validateCronField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;
  const stepMatch = field.match(/^\*\/(\d+)$/);
  if (stepMatch) {
    const step = Number(stepMatch[1]);
    return step >= 1 && step <= max;
  }
  return field.split(',').every((part) => {
    const m = part.match(/^(\d+)(?:-(\d+))?(?:\/(\d+))?$/);
    if (!m) return false;
    const start = Number(m[1]);
    const end = m[2] !== undefined ? Number(m[2]) : start;
    const step = m[3] !== undefined ? Number(m[3]) : 1;
    if (start < min || start > max) return false;
    if (end < start || end > max) return false;
    if (step < 1) return false;
    return true;
  });
}

const CronExpression = z.string().refine(
  (val) => {
    const fields = val.trim().split(/\s+/);
    if (fields.length !== 5) return false;
    return fields.every((f, i) => {
      const [min, max] = FIELD_RANGES[i]!;
      return validateCronField(f, min, max);
    });
  },
  { message: 'cron schedule must be a valid 5-field expression with in-range values' },
);
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run lib/shared/types.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/types.ts lib/shared/types.test.ts
git commit -m "fix(loader): per-field range validation for cron expressions"
```

---

### Task 10: Reject path traversal in manifest component / api paths

Manifest `route.component`, `widget.component`, and `api.path` are joined into filesystem reads in `assertFileExists`. A manifest with `component: '../../../etc/passwd'` would resolve outside the module directory. Add a normalize-and-check helper.

**Files:**
- Modify: `lib/shared/module-loader.ts`
- Modify: `lib/shared/module-loader.test.ts`

- [ ] **Step 1: Write the failing test**

Append:

```ts
it('rejects manifest paths that escape the module directory', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-'));
  const cfg = {
    id: 'x',
    routes: [{ path: '/', component: '../../etc/passwd', shareable: false as const }],
    api: [], widgets: [], cron: [],
    env: { required: [], optional: [] },
  };
  await expect(validateModuleStructure(dir, cfg)).rejects.toThrow(/outside module/);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/module-loader.test.ts`
Expected: 1 failure.

- [ ] **Step 3: Add the check inside `assertFileExists`**

```ts
async function assertFileExists(
  dir: string,
  relative: string,
  extensions: string[],
): Promise<void> {
  const moduleRoot = path.resolve(dir) + path.sep;
  for (const ext of extensions) {
    const resolved = path.resolve(dir, relative + ext);
    if (!resolved.startsWith(moduleRoot)) {
      throw new Error(`Manifest path "${relative}" resolves outside module directory ${dir}`);
    }
    try {
      await fs.access(resolved);
      return;
    } catch {
      // try next extension
    }
  }
  throw new Error(`File not found at ${relative} (extensions: ${extensions.join(', ')}) in ${dir}`);
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run lib/shared/module-loader.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/module-loader.ts lib/shared/module-loader.test.ts
git commit -m "fix(loader): reject manifest paths that escape the module directory"
```

---

### Task 11: Verify API handler exports cover every method declared in the manifest

`validateModuleStructure` currently asserts the file exists but doesn't load it to check the declared methods are exported. Wire the check.

**Files:**
- Modify: `lib/shared/module-loader.ts`
- Modify: `lib/shared/module-loader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('rejects when an API handler is missing a declared method export', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mod-'));
  await fs.mkdir(path.join(dir, 'api'));
  // file exports GET only, but manifest claims GET + POST
  await fs.writeFile(
    path.join(dir, 'api', 'health.ts'),
    'export async function GET(){ return new Response("ok") }',
  );
  const cfg = {
    id: 'x',
    routes: [],
    api: [{ path: '/health', methods: ['GET', 'POST'] as const }],
    widgets: [], cron: [],
    env: { required: [], optional: [] },
  };
  await expect(validateModuleStructure(dir, cfg)).rejects.toThrow(/POST/);
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/module-loader.test.ts`
Expected: 1 failure.

- [ ] **Step 3: Add the export check after the existence check**

In the `for (const api of config.api)` block:

```ts
for (const api of config.api) {
  const handlerName =
    api.path === '/' ? 'index' : api.path.replace(/^\//, '').replace(/\//g, '.');
  const filePath = path.join(dir, 'api', handlerName + '.ts');
  await assertFileExists(dir, path.join('api', handlerName), ['.ts']);

  const mod = (await import(/* @vite-ignore */ pathToFileURL(filePath).href)) as Record<
    string,
    unknown
  >;
  for (const method of api.methods) {
    if (typeof mod[method] !== 'function') {
      throw new Error(
        `Module "${config.id}" api ${api.path} declares ${method} but file does not export a ${method} function`,
      );
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run lib/shared/module-loader.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/module-loader.ts lib/shared/module-loader.test.ts
git commit -m "feat(loader): verify api handler files export every declared method"
```

---

### Task 12: Turn off `passWithNoTests` so the coverage gate can fire

`vitest.config.ts` sets `passWithNoTests: true` — a brand-new file with no test produces a green run. The coverage `thresholds: { lines: 80 ... }` is collected only over `include`d files, but `passWithNoTests` lets a totally missing test file slip past.

**Files:**
- Modify: `vitest.config.ts`

- [ ] **Step 1: Flip the flag**

```ts
// vitest.config.ts
// ...
test: {
  environment: 'jsdom',
  setupFiles: ['./vitest.setup.ts'],
  globals: true,
  passWithNoTests: false,
  // ...
},
```

- [ ] **Step 2: Run the suite**

Run: `pnpm test:run`
Expected: still passes (existing tests cover the existing surface). If a file's removal of tests would have been silent, that's now an error — fix by re-adding tests rather than reverting this flag.

- [ ] **Step 3: Commit**

```bash
git add vitest.config.ts
git commit -m "test(config): disable passWithNoTests so missing tests fail CI"
```

---

## Checkpoint 2 — Build-time validation hardening

**Stop here. Do not start Phase 3 until every command below passes and Kevin has confirmed.**

```bash
pnpm test:run
pnpm typecheck
pnpm lint
pnpm build           # must still succeed end-to-end
pnpm test:coverage   # confirm lib/shared coverage still ≥ 80%
```

**What this verifies:** ESLint runs during builds, the module loader validates env / cron field ranges / path traversal / API method exports, and Vitest no longer hides missing tests. Build-time guarantees in CLAUDE.md §2.8 are restored.

---

# Phase 3 — Type safety & runtime input validation

### Task 13: Runtime-validate dynamic module imports (`loadModuleExport`)

`loadModuleExport<T>()` casts to `T` with no runtime check. Callers can request a "shape" by passing a Zod schema; if absent, the unsafe cast remains but is opt-in. Convert the existing two call sites (API gateway, share-render, widget-render) to provide a schema or a `validator` callback.

**Files:**
- Modify: `lib/shared/module-import.ts`
- Modify: `lib/shared/share-render.ts`
- Modify: `lib/shared/widget-render.ts`
- Modify: `app/api/[moduleId]/[...rest]/route.ts`
- Test: `lib/shared/module-import.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// lib/shared/module-import.test.ts
import { describe, it, expect, vi } from 'vitest';

const importMock = vi.fn();
vi.mock('./module-import-impl', () => ({ importModuleFile: importMock }));

import { loadModuleExport } from './module-import';

describe('loadModuleExport', () => {
  it('returns the module when validator passes', async () => {
    importMock.mockResolvedValueOnce({ default: () => null });
    const out = await loadModuleExport(
      'm',
      'routes/index',
      (mod): mod is { default: () => null } =>
        typeof (mod as { default?: unknown }).default === 'function',
    );
    expect(typeof out.default).toBe('function');
  });
  it('throws when validator rejects', async () => {
    importMock.mockResolvedValueOnce({ wrong: 1 });
    await expect(
      loadModuleExport('m', 'routes/index', (m): m is { default: () => null } => false),
    ).rejects.toThrow(/shape/);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/module-import.test.ts`
Expected: FAIL — `module-import-impl` doesn't exist; current `loadModuleExport` has no validator parameter.

- [ ] **Step 3: Refactor**

Split the file so the dynamic-import call is in a separately mock-able location, and add a validator parameter:

```ts
// lib/shared/module-import-impl.ts
import 'server-only';

export async function importModuleFile(
  moduleId: string,
  relativePath: string,
): Promise<unknown> {
  try {
    return await import(
      /* webpackInclude: /(?<!\.test)\.tsx$/ */
      `@/modules/${moduleId}/${relativePath}.tsx`
    );
  } catch (errTsx) {
    try {
      return await import(
        /* webpackInclude: /(?<!\.test)\.ts$/ */
        `@/modules/${moduleId}/${relativePath}.ts`
      );
    } catch (errTs) {
      throw new Error(
        `Failed to load module export @/modules/${moduleId}/${relativePath}: ` +
          `tsx=${(errTsx as Error).message}; ts=${(errTs as Error).message}`,
      );
    }
  }
}
```

```ts
// lib/shared/module-import.ts
import 'server-only';
import { importModuleFile } from './module-import-impl';

export type ModuleExportValidator<T> = (mod: unknown) => mod is T;

export async function loadModuleExport<T>(
  moduleId: string,
  relativePath: string,
  validator: ModuleExportValidator<T>,
): Promise<T> {
  const raw = await importModuleFile(moduleId, relativePath);
  if (!validator(raw)) {
    throw new Error(
      `Loaded module export at @/modules/${moduleId}/${relativePath} did not match expected shape`,
    );
  }
  return raw;
}
```

- [ ] **Step 4: Update every caller to pass a validator**

`lib/shared/share-render.ts`:

```ts
const imported = await loadModuleExport(
  moduleId,
  routeDef.component,
  (m): m is { default: (p: { shareScope: { moduleId: string; route: string; tokenId: string } }) =>
    Promise<ReactElement> | ReactElement } =>
      typeof (m as { default?: unknown }).default === 'function',
);
```

`lib/shared/widget-render.ts`:

```ts
const imported = await loadModuleExport(
  moduleId,
  widget.component,
  (m): m is { default: (p?: unknown) => Promise<ReactElement> | ReactElement } =>
    typeof (m as { default?: unknown }).default === 'function',
);
```

`app/api/[moduleId]/[...rest]/route.ts`:

```ts
const imported = await loadModuleExport(
  moduleId,
  `api/${handlerName}`,
  (m): m is Record<string, unknown> => typeof m === 'object' && m !== null,
);
// fn check later (typeof fn !== 'function') remains.
```

- [ ] **Step 5: Run all related tests**

Run: `pnpm test:run lib/shared/module-import.test.ts lib/shared/share-render.test.ts lib/shared/widget-render.test.ts app/api`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add lib/shared/module-import.ts lib/shared/module-import-impl.ts lib/shared/module-import.test.ts \
        lib/shared/share-render.ts lib/shared/widget-render.ts app/api/\[moduleId\]/\[...rest\]/route.ts
git commit -m "feat(types): require shape validators for every loadModuleExport call"
```

---

### Task 14: Zod-validate `widgetLayouts.layout` on read and write

`widget-layout-store.ts` returns the raw `jsonb` value as `WidgetLayoutEntry[]` without parsing. A corrupted row crashes the home page. Wrap both `loadLayout` and `saveLayout` with a Zod schema.

**Files:**
- Modify: `lib/shared/widget-layout-store.ts`
- Test: `lib/shared/widget-layout-store.test.ts` (new)

- [ ] **Step 1: Write the failing test**

```ts
// lib/shared/widget-layout-store.test.ts
import { describe, it, expect, vi } from 'vitest';

const selectChain = (rows: unknown[]) => ({
  from: () => ({ where: vi.fn().mockResolvedValue(rows) }),
});
const insertChain = () => ({
  values: () => ({ onConflictDoUpdate: vi.fn().mockResolvedValue(undefined) }),
});

vi.mock('./db', () => ({
  db: { select: vi.fn(() => selectChain([])), insert: vi.fn(() => insertChain()) },
}));

import { db } from './db';
import { loadLayout, saveLayout, WidgetLayoutSchema } from './widget-layout-store';

describe('widget-layout-store', () => {
  it('returns null when no row exists', async () => {
    vi.mocked(db.select).mockReturnValueOnce(selectChain([]) as never);
    expect(await loadLayout()).toBeNull();
  });
  it('returns parsed entries for a valid row', async () => {
    const layout = [
      { moduleId: 'a', widgetId: 'b', enabled: true, x: 0, y: 0, w: 2, h: 2 },
    ];
    vi.mocked(db.select).mockReturnValueOnce(selectChain([{ layout }]) as never);
    expect(await loadLayout()).toEqual(layout);
  });
  it('throws when the stored layout is malformed', async () => {
    vi.mocked(db.select).mockReturnValueOnce(
      selectChain([{ layout: [{ moduleId: 'a' }] }]) as never,
    );
    await expect(loadLayout()).rejects.toThrow();
  });
  it('rejects writes that fail schema validation', async () => {
    // @ts-expect-error intentionally bad input
    await expect(saveLayout([{ moduleId: 1, widgetId: 'b' }])).rejects.toThrow();
  });
  it('exports a usable schema', () => {
    expect(
      WidgetLayoutSchema.safeParse([
        { moduleId: 'a', widgetId: 'b', enabled: true, x: 0, y: 0, w: 2, h: 2 },
      ]).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/widget-layout-store.test.ts`
Expected: failures across the suite.

- [ ] **Step 3: Implement schema + validation**

Replace `lib/shared/widget-layout-store.ts`:

```ts
import 'server-only';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { widgetLayouts, type WidgetLayoutEntry } from '@/platform/db/schema';

const SINGLETON_ID = 'singleton';

export const WidgetLayoutEntrySchema = z.object({
  moduleId: z.string().min(1),
  widgetId: z.string().min(1),
  enabled: z.boolean(),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
export const WidgetLayoutSchema = z.array(WidgetLayoutEntrySchema);

export async function loadLayout(): Promise<WidgetLayoutEntry[] | null> {
  const rows = await db.select().from(widgetLayouts).where(eq(widgetLayouts.id, SINGLETON_ID));
  const raw = rows[0]?.layout ?? null;
  if (raw === null) return null;
  return WidgetLayoutSchema.parse(raw);
}

export async function saveLayout(layout: unknown): Promise<void> {
  const parsed = WidgetLayoutSchema.parse(layout);
  await db
    .insert(widgetLayouts)
    .values({ id: SINGLETON_ID, layout: parsed })
    .onConflictDoUpdate({
      target: widgetLayouts.id,
      set: { layout: parsed, updatedAt: new Date() },
    });
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run lib/shared/widget-layout-store.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/widget-layout-store.ts lib/shared/widget-layout-store.test.ts
git commit -m "fix(layout): Zod-validate widget layout on read and write"
```

---

### Task 15: Validate `saveLayoutAction` input + move type away from `@/platform`

`app/(shell)/save-layout-action.ts` imports the layout type from `@/platform/db/schema` (a platform-internal coupling) and trusts the client-supplied array. Switch both files to the Zod schema's inferred type so the action validates before persisting and HomeGrid imports from `lib/shared`.

**Files:**
- Modify: `app/(shell)/save-layout-action.ts`
- Modify: `app/(shell)/HomeGrid.tsx`
- Modify: `app/(shell)/page.tsx` (if it imports the type)
- Test: `app/(shell)/save-layout-action.test.ts` (new)

- [ ] **Step 1: Export the type from the layout store**

In `lib/shared/widget-layout-store.ts` add:

```ts
export type WidgetLayout = z.infer<typeof WidgetLayoutSchema>;
```

- [ ] **Step 2: Write the failing test**

```ts
// app/(shell)/save-layout-action.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/shared/auth', () => ({ requireOwner: vi.fn() }));
const saveLayoutMock = vi.fn();
vi.mock('@/lib/shared/widget-layout-store', async () => {
  const real = await vi.importActual<typeof import('@/lib/shared/widget-layout-store')>(
    '@/lib/shared/widget-layout-store',
  );
  return { ...real, saveLayout: saveLayoutMock };
});

import { saveLayoutAction } from './save-layout-action';

describe('saveLayoutAction', () => {
  it('rejects malformed input', async () => {
    await expect(saveLayoutAction([{ moduleId: 1 } as never])).rejects.toThrow();
    expect(saveLayoutMock).not.toHaveBeenCalled();
  });
  it('forwards a valid layout', async () => {
    await saveLayoutAction([
      { moduleId: 'a', widgetId: 'b', enabled: true, x: 0, y: 0, w: 2, h: 2 },
    ]);
    expect(saveLayoutMock).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 3: Run to confirm failure**

Run: `pnpm test:run app/\(shell\)/save-layout-action.test.ts`
Expected: 2 failures.

- [ ] **Step 4: Update the action**

```ts
// app/(shell)/save-layout-action.ts
'use server';

import {
  saveLayout,
  WidgetLayoutSchema,
  type WidgetLayout,
} from '@/lib/shared/widget-layout-store';
import { requireOwner } from '@/lib/shared/auth';

export async function saveLayoutAction(layout: WidgetLayout): Promise<void> {
  await requireOwner();
  const parsed = WidgetLayoutSchema.parse(layout);
  await saveLayout(parsed);
}
```

- [ ] **Step 5: Update HomeGrid's import**

```tsx
// app/(shell)/HomeGrid.tsx
import type { WidgetLayout } from '@/lib/shared/widget-layout-store';

type Props = {
  initialLayout: WidgetLayout;
  widgets: Record<string, React.ReactNode>;
};
```

Remove `import type { WidgetLayoutEntry } from '@/platform/db/schema';` and replace all `WidgetLayoutEntry[]` occurrences with `WidgetLayout`. Adjust any callers (e.g. `app/(shell)/page.tsx`) the same way — search with: `grep -rn "WidgetLayoutEntry" app/ components/ 2>/dev/null`.

- [ ] **Step 6: Run tests + typecheck**

Run: `pnpm test:run app/\(shell\) && pnpm typecheck`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add lib/shared/widget-layout-store.ts app/\(shell\)/save-layout-action.ts \
        app/\(shell\)/save-layout-action.test.ts app/\(shell\)/HomeGrid.tsx app/\(shell\)/page.tsx
git commit -m "fix(layout): validate saveLayoutAction input, decouple shell type from platform schema"
```

---

### Task 16: Debounce + serialize layout writes in `HomeGrid`

`onLayoutChange` fires for every drag tick and dispatches `saveLayoutAction` with no debounce or write ordering — a slower earlier call can land after a later one. Add a debounce and a "queue the latest" pattern (drop intermediate writes).

**Files:**
- Modify: `app/(shell)/HomeGrid.tsx`

- [ ] **Step 1: Refactor HomeGrid to coalesce writes**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout/legacy';
import 'react-grid-layout/css/styles.css';
import { WidgetErrorBoundary } from '@/components/shell/boundaries/WidgetErrorBoundary';
import type { WidgetLayout } from '@/lib/shared/widget-layout-store';
import { saveLayoutAction } from './save-layout-action';

type Props = {
  initialLayout: WidgetLayout;
  widgets: Record<string, React.ReactNode>;
};

const DEBOUNCE_MS = 400;

export function HomeGrid({ initialLayout, widgets }: Props) {
  const [layout, setLayout] = useState(initialLayout);
  const pendingRef = useRef<WidgetLayout | null>(null);
  const inflightRef = useRef<Promise<void> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  function flush() {
    timerRef.current = null;
    const next = pendingRef.current;
    pendingRef.current = null;
    if (!next) return;
    inflightRef.current = (async () => {
      try { await saveLayoutAction(next); } finally { inflightRef.current = null; }
      if (pendingRef.current) flush();
    })();
  }

  function scheduleSave(next: WidgetLayout) {
    pendingRef.current = next;
    if (timerRef.current) return;
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }

  const gridLayout = layout
    .filter((l) => l.enabled)
    .map((l) => ({
      i: `${l.moduleId}:${l.widgetId}`,
      x: l.x, y: l.y, w: l.w, h: l.h,
    }));

  return (
    <GridLayout
      className="layout"
      cols={12}
      rowHeight={80}
      width={1100}
      layout={gridLayout}
      onLayoutChange={(next) => {
        const merged: WidgetLayout = layout.map((entry) => {
          const found = next.find((n) => n.i === `${entry.moduleId}:${entry.widgetId}`);
          if (!found) return entry;
          return { ...entry, x: found.x, y: found.y, w: found.w, h: found.h };
        });
        setLayout(merged);
        scheduleSave(merged);
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

- [ ] **Step 2: Smoke-test by hand**

Run: `pnpm dev`. Drag a widget rapidly across the grid. Expect at most one network call to `save-layout-action` per ~400 ms — confirm via the Network tab. Final position persists across reload.

- [ ] **Step 3: Commit**

```bash
git add app/\(shell\)/HomeGrid.tsx
git commit -m "fix(layout): debounce + serialize HomeGrid saves to prevent stale writes"
```

---

### Task 17: Decouple `listShareLinks` callers from the raw schema row, exclude expired

CLAUDE.md flags `listShareLinks()` as misleading because it filters only on `revokedAt IS NULL` — expired-but-not-revoked rows show as active. Fix the query and project to a typed return.

**Files:**
- Modify: `lib/shared/share-links.ts`
- Modify: `lib/shared/share-links.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `lib/shared/share-links.test.ts` (uses the existing `mocks.selectMock` pattern that other tests in the file already use):

```ts
describe('listShareLinks filters', () => {
  it('excludes expired and revoked entries via the WHERE clause', async () => {
    // Capture the WHERE expression Drizzle is asked to apply.
    const whereCapture = vi.fn().mockResolvedValue([]);
    mocks.selectMock.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({ where: whereCapture }),
    } as never);

    await listShareLinks();

    expect(whereCapture).toHaveBeenCalledOnce();
    // The where expression must reference BOTH revoked_at AND expires_at columns
    // (the AND-of-isNull-revoked AND or(isNull-expires, gt-expires-now) tree).
    const expr = JSON.stringify(whereCapture.mock.calls[0]![0]);
    expect(expr).toMatch(/revoked_at/);
    expect(expr).toMatch(/expires_at/);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test:run lib/shared/share-links.test.ts`
Expected: 1 failure — expired row appears.

- [ ] **Step 3: Update the query**

```ts
import { and, eq, gt, isNull, or } from 'drizzle-orm';

export async function listShareLinks() {
  const now = new Date();
  return db
    .select()
    .from(shareLinks)
    .where(
      and(
        isNull(shareLinks.revokedAt),
        or(isNull(shareLinks.expiresAt), gt(shareLinks.expiresAt, now)),
      ),
    );
}
```

- [ ] **Step 4: Run tests**

Run: `pnpm test:run lib/shared/share-links.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/share-links.ts lib/shared/share-links.test.ts
git commit -m "fix(share-links): listShareLinks must also exclude expired links"
```

---

## Checkpoint 3 — Type safety & input validation

**Stop here. Do not start Phase 4 until every command below passes and Kevin has confirmed.**

```bash
pnpm test:run
pnpm typecheck
pnpm lint
pnpm dev   # then manually drag a home-page widget, reload, confirm position persists
```

**What this verifies:** Every dynamic import is shape-validated, layout JSON is parsed on read and write, the layout server action rejects bad input, drag events are debounced, and `listShareLinks` reflects actual usable links.

---

# Phase 4 — Migration ownership & shell↔platform boundary

### Task 18: Split Drizzle configs (platform vs modules)

`drizzle.config.ts` combines `./platform/db/schema.ts` and `./modules/*/db/schema.ts` into a single output (`./platform/db/migrations`). The result is the violation Codex flagged: smoke's `CREATE SCHEMA "smoke"` lives in a platform migration. Split into two configs and outputs.

**Files:**
- Modify: `drizzle.config.ts` (platform-only)
- Create: `drizzle.modules.config.ts`

- [ ] **Step 1: Reduce `drizzle.config.ts` to platform scope**

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./platform/db/schema.ts'],
  out: './platform/db/migrations',
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 2: Add per-module config (we run it once per module via the orchestrator in Task 20)**

```ts
// drizzle.modules.config.ts
import { defineConfig } from 'drizzle-kit';

const moduleId = process.env.DRIZZLE_MODULE_ID;
if (!moduleId) {
  throw new Error('DRIZZLE_MODULE_ID must be set when running drizzle for a module');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: [`./modules/${moduleId}/db/schema.ts`],
  out: `./modules/${moduleId}/db/migrations`,
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
```

- [ ] **Step 3: Commit (no migration changes yet)**

```bash
git add drizzle.config.ts drizzle.modules.config.ts
git commit -m "chore(db): split Drizzle configs into platform and per-module"
```

---

### Task 19: Move smoke's migration out of `platform/db/migrations`

The existing platform migration `0002_strong_marvel_apes.sql` creates `smoke` schema + `_placeholder` table. Move that statement into a smoke module migration and mark the dev DB as already-migrated for the new file (Drizzle uses the `__drizzle_migrations` table to track applied migrations by hash).

Pragmatic path for a single-user early-dev project: **reset the dev DB** so the migration history matches the new layout exactly. CLAUDE.md §11.2 expects this for shared branches.

**Files:**
- Create: `modules/smoke/db/migrations/0000_initial.sql`
- Modify: `platform/db/migrations/0002_strong_marvel_apes.sql` (remove smoke statements OR re-issue platform migrations cleanly — see Step 4)
- Modify: `platform/db/migrations/meta/_journal.json` (Drizzle tracks file hashes here)

- [ ] **Step 1: Snapshot what's in `0002_strong_marvel_apes.sql`**

Run: `cat platform/db/migrations/0002_strong_marvel_apes.sql`
Confirm the smoke-schema statements are present.

- [ ] **Step 2: Create the smoke module's first migration**

```sql
-- modules/smoke/db/migrations/0000_initial.sql
CREATE SCHEMA "smoke";
--> statement-breakpoint
CREATE TABLE "smoke"."_placeholder" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
```

Create the matching meta directory by running drizzle-kit to scaffold it, then aligning the file Drizzle generates:

```bash
DRIZZLE_MODULE_ID=smoke pnpm dotenv -e .env.local -- drizzle-kit generate \
  --config drizzle.modules.config.ts --name initial
```

If drizzle generates a fresh `0000_<random>.sql` instead of using your hand-written file, delete the hand-written one and keep drizzle's output (the SQL should be identical for the smoke schema).

- [ ] **Step 3: Strip smoke statements from the platform migration**

Edit `platform/db/migrations/0002_strong_marvel_apes.sql` so it no longer references the `smoke` schema. If the file becomes empty, delete it AND remove its entry from `platform/db/migrations/meta/_journal.json`.

- [ ] **Step 4: Reset the dev DB and re-apply both**

```bash
# Connect to your Neon dev branch and drop both schemas (one-time, dev branch only)
psql "$(grep ^DATABASE_URL .env.local | cut -d= -f2-)" \
  -c 'DROP SCHEMA IF EXISTS platform CASCADE; DROP SCHEMA IF EXISTS smoke CASCADE; DROP TABLE IF EXISTS public.__drizzle_migrations;'

pnpm db:migrate                     # runs platform (Task 20 makes this also run modules)
DRIZZLE_MODULE_ID=smoke pnpm dotenv -e .env.local -- drizzle-kit migrate \
  --config drizzle.modules.config.ts
```

(Task 20 wires the second step into a single `pnpm db:migrate`.)

- [ ] **Step 5: Verify schemas exist with correct tables**

```bash
psql "$(grep ^DATABASE_URL .env.local | cut -d= -f2-)" -c '\dn'
psql "$(grep ^DATABASE_URL .env.local | cut -d= -f2-)" -c '\dt platform.*; \dt smoke.*'
```

Expected: `platform` and `smoke` schemas; smoke contains `_placeholder`.

- [ ] **Step 6: Commit**

```bash
git add modules/smoke/db/migrations platform/db/migrations
git commit -m "fix(db): move smoke schema creation into modules/smoke/db/migrations"
```

---

### Task 20: Implement orchestrated `db:migrate` (platform → modules alphabetical)

CLAUDE.md §11.2 promises `pnpm db:migrate` runs platform first, then each module alphabetically. Today it only runs `drizzle-kit migrate` against the platform config.

**Files:**
- Create: `scripts/migrate-all.ts`
- Modify: `package.json` (point `db:migrate` at the new script)

- [ ] **Step 1: Implement the orchestrator**

```ts
// scripts/migrate-all.ts
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv = process.env) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', env });
  if (r.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function modulesWithMigrations(): string[] {
  const root = path.resolve(process.cwd(), 'modules');
  if (!fs.existsSync(root)) return [];
  return fs
    .readdirSync(root)
    .filter((name) => !name.startsWith('_') && !name.startsWith('.'))
    .filter((name) => fs.existsSync(path.join(root, name, 'db', 'migrations')))
    .sort();
}

function main() {
  console.log('→ Migrating platform');
  run('pnpm', ['dotenv', '-e', '.env.local', '--', 'drizzle-kit', 'migrate']);

  for (const id of modulesWithMigrations()) {
    console.log(`→ Migrating module ${id}`);
    run(
      'pnpm',
      ['dotenv', '-e', '.env.local', '--', 'drizzle-kit', 'migrate', '--config', 'drizzle.modules.config.ts'],
      { ...process.env, DRIZZLE_MODULE_ID: id },
    );
  }
}

main();
```

- [ ] **Step 2: Repoint the script**

```json
// package.json scripts
"db:migrate": "tsx scripts/migrate-all.ts",
```

- [ ] **Step 3: Run it end-to-end on the dev DB**

```bash
pnpm db:migrate
```

Expected: "Migrating platform" then "Migrating module smoke", both succeed. Re-running should be a no-op.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-all.ts package.json
git commit -m "feat(db): db:migrate runs platform then modules alphabetically"
```

---

### Task 21: Add `lib/public-api.ts` stub to the module template (and smoke)

CLAUDE.md §5.1 requires `lib/public-api.ts` as the only sanctioned cross-module import surface. The `_template` lacks it; smoke lacks it. Add empty barrels so future modules start with one.

**Files:**
- Create: `modules/_template/lib/public-api.ts.template`
- Create: `modules/smoke/lib/public-api.ts`
- Modify: `scripts/new-module.ts` (if it lists template files explicitly)

- [ ] **Step 1: Add the template barrel**

```ts
// modules/_template/lib/public-api.ts.template
// Read-only queries other modules MAY import. Keep narrow — every export
// here is a stable contract. Do NOT export mutations.
export {};
```

- [ ] **Step 2: Add the smoke barrel**

```ts
// modules/smoke/lib/public-api.ts
export {};
```

- [ ] **Step 3: Confirm `new-module.ts` copies the template file**

Run: `grep -n 'public-api' scripts/new-module.ts || echo 'needs update'`. If the scaffolder uses a glob (e.g. `cp -r template/* …`), no change is needed. If it lists files explicitly, add `lib/public-api.ts`.

- [ ] **Step 4: Commit**

```bash
git add modules/_template/lib/public-api.ts.template modules/smoke/lib/public-api.ts scripts/new-module.ts
git commit -m "chore(template): scaffold lib/public-api.ts barrel for every module"
```

---

### Task 22: Add `pnpm db:reset` so the documented workflow actually exists

CLAUDE.md §11.2 lists `pnpm db:reset` as "drop schemas, re-migrate, re-seed". It's not in `package.json`. Add a small script.

**Files:**
- Create: `scripts/db-reset.ts`
- Modify: `package.json`

- [ ] **Step 1: Implement**

```ts
// scripts/db-reset.ts
import { spawnSync } from 'node:child_process';
import postgres from 'postgres';
import * as fs from 'node:fs';
import * as path from 'node:path';
import 'dotenv/config';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL not set');
  const sql = postgres(url, { max: 1 });
  try {
    const schemas = ['platform'];
    const modulesDir = path.resolve(process.cwd(), 'modules');
    if (fs.existsSync(modulesDir)) {
      for (const id of fs
        .readdirSync(modulesDir)
        .filter((n) => !n.startsWith('_') && !n.startsWith('.'))) {
        schemas.push(id.replace(/-/g, '_'));
      }
    }
    for (const schema of schemas) {
      console.log(`→ DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await sql.unsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await sql.unsafe('DROP TABLE IF EXISTS public.__drizzle_migrations');
  } finally {
    await sql.end();
  }
  const r = spawnSync('pnpm', ['db:migrate'], { stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

void main();
```

- [ ] **Step 2: Wire the script**

```json
// package.json scripts
"db:reset": "tsx -r dotenv/config scripts/db-reset.ts dotenv_config_path=.env.local",
```

- [ ] **Step 3: Smoke-test it on the dev DB**

```bash
pnpm db:reset
psql "$(grep ^DATABASE_URL .env.local | cut -d= -f2-)" -c '\dn'
```

Expected: `platform` + `smoke` schemas re-created after reset.

- [ ] **Step 4: Commit**

```bash
git add scripts/db-reset.ts package.json
git commit -m "feat(db): pnpm db:reset drops schemas and re-runs migrations"
```

---

## Checkpoint 4 — Migration ownership & shell↔platform boundary

**Stop here. Do not start Phase 5 until every command below passes and Kevin has confirmed.**

```bash
pnpm test:run
pnpm typecheck
pnpm lint
pnpm db:reset            # destructive on dev branch — confirm
pnpm db:migrate          # second run is a no-op
pnpm build
```

Verify:

```bash
psql "$(grep ^DATABASE_URL .env.local | cut -d= -f2-)" -c '\dn'
# Expected: schemas listed include `platform` and `smoke`

ls modules/smoke/db/migrations/   # expect one initial migration + meta/
ls platform/db/migrations/        # expect platform tables only, no smoke statements
```

**What this verifies:** Migrations are owned by their respective subsystems, `pnpm db:migrate` enforces order, and the shell no longer touches platform tables directly.

---

# Phase 5 — Test coverage gaps

### Task 23: Cover `lib/shared/errors.ts`

Existing error classes are exercised indirectly through `with-error-handler` but have no direct tests. Add one.

**Files:**
- Create: `lib/shared/errors.test.ts`

`lib/shared/errors.ts` exports three classes: `NotFoundError`, `ForbiddenError`, `UnauthorizedError`. Each takes a single optional message string and sets its own `.name`.

- [ ] **Step 1: Write the test**

```ts
// lib/shared/errors.test.ts
import { describe, it, expect } from 'vitest';
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors';

describe('shared error classes', () => {
  it('ForbiddenError carries message + name + default message', () => {
    expect(new ForbiddenError('nope').message).toBe('nope');
    expect(new ForbiddenError('nope').name).toBe('ForbiddenError');
    expect(new ForbiddenError()).toBeInstanceOf(Error);
    expect(new ForbiddenError().message).toBe('Forbidden');
  });
  it('NotFoundError has its own name and default message', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new NotFoundError().message).toBe('Not found');
    expect(new NotFoundError('row 42').message).toBe('row 42');
  });
  it('UnauthorizedError has its own name and default message', () => {
    expect(new UnauthorizedError().name).toBe('UnauthorizedError');
    expect(new UnauthorizedError().message).toBe('Unauthorized');
  });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:run lib/shared/errors.test.ts`
Expected: pass.

- [ ] **Step 4: Commit**

```bash
git add lib/shared/errors.test.ts
git commit -m "test: cover shared error classes directly"
```

---

### Task 24: Add success-path test for `share-render`

`lib/shared/share-render.test.ts` only covers the failure cases (missing module / non-shareable route). Add the happy path.

**Files:**
- Modify: `lib/shared/share-render.test.ts`

- [ ] **Step 1: Add the test**

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./registry', () => ({
  getModuleById: vi.fn().mockResolvedValue({
    config: {
      id: 'm',
      routes: [{ path: '/r', component: 'routes/r', shareable: { mode: 'read-only' } }],
    },
  }),
}));
vi.mock('./module-import', () => ({
  loadModuleExport: vi.fn().mockResolvedValue({
    default: vi.fn().mockImplementation((p: { shareScope: unknown }) =>
      ({ type: 'div', props: { 'data-scope': JSON.stringify(p.shareScope) }, key: null } as never),
    ),
  }),
}));

import { renderSharedModuleRoute } from './share-render';
import { loadModuleExport } from './module-import';

describe('renderSharedModuleRoute success path', () => {
  it('passes shareScope to the module default export', async () => {
    const el = await renderSharedModuleRoute('m', '/r', 'tok123');
    expect(loadModuleExport).toHaveBeenCalledWith('m', 'routes/r', expect.any(Function));
    // assert the default function received our shareScope
    const calls = (loadModuleExport as unknown as { mock: { results: { value: { default: ReturnType<typeof vi.fn> } }[] } })
      .mock.results;
    const defaultFn = calls[0]!.value.default;
    expect(defaultFn).toHaveBeenCalledWith({ shareScope: { moduleId: 'm', route: '/r', tokenId: 'tok123' } });
    expect(el).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run**

Run: `pnpm test:run lib/shared/share-render.test.ts`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/shared/share-render.test.ts
git commit -m "test: cover share-render success path with shareScope assertion"
```

---

### Task 25: Add real-render test for `widget-render`

`lib/shared/widget-render.test.ts` only covers empty cases. Add a test that goes through `loadModuleExport` and renders a widget component.

**Files:**
- Modify: `lib/shared/widget-render.test.ts`

The real export is `renderAllWidgets()` (no arguments, returns a `Record<string, ReactNode>` keyed by `${moduleId}:${widgetId}`). Mock `getModules` (not `getModuleById`) accordingly.

- [ ] **Step 1: Add the test**

```ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('./registry', () => ({
  getModules: vi.fn().mockResolvedValue([
    {
      dir: '/x',
      config: {
        id: 'm',
        widgets: [
          { id: 'w', name: 'W', defaultSize: { w: 1, h: 1 }, minSize: { w: 1, h: 1 }, component: 'widgets/W' },
        ],
      },
    },
  ]),
}));
vi.mock('./module-import', () => ({
  loadModuleExport: vi.fn().mockResolvedValue({ default: () => 'rendered' }),
}));

import { renderAllWidgets } from './widget-render';

describe('renderAllWidgets success path', () => {
  it('loads and invokes each widget, keyed by moduleId:widgetId', async () => {
    const out = await renderAllWidgets();
    expect(out).toEqual({ 'm:w': 'rendered' });
  });
});
```

(After Task 13 lands, `loadModuleExport` requires a validator argument — that change is internal to `widget-render.ts`; this test still mocks `loadModuleExport` whole, so no change here.)

- [ ] **Step 2: Run**

Run: `pnpm test:run lib/shared/widget-render.test.ts`
Expected: pass.

- [ ] **Step 3: Commit**

```bash
git add lib/shared/widget-render.test.ts
git commit -m "test: cover widget-render dynamic import success path"
```

---

### Task 26: Final pre-merge sweep + coverage gate run

Run the full pipeline, fix any coverage gaps the previous tasks left, and document the close-out.

**Files:** none (verification + possible touch-ups)

- [ ] **Step 1: Full local pipeline**

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:coverage     # confirm thresholds still met after all changes
pnpm build
```

Expected: all green. If coverage dipped below 80% on any included file (`lib/shared/**` or `modules/*/lib/**`), add tests until it's restored — do not lower the threshold.

- [ ] **Step 2: Spot-check the proxy + cron paths in the running app**

```bash
pnpm dev &
sleep 5

# Anonymous read on a non-share route — passes proxy (proxy ignores non-share contexts)
curl -i http://localhost:3000/api/smoke/health
# Expected: 401 (no owner, no cron)

# Share cookie + POST — blocked by proxy with 403
curl -i -X POST -H 'cookie: dashboard_share=any' http://localhost:3000/api/smoke/health
# Expected: 403

# Cron path
CRON_SECRET=$(grep -E '^CRON_SECRET=' .env.local | cut -d= -f2-)
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/smoke/cron/yearly
# Expected: 200
```

Kill the dev server after verifying.

- [ ] **Step 3: Commit (only if any touch-ups were needed)**

```bash
git add -A
git commit -m "test: shore up coverage after adversarial-review fixes"
```

---

## Checkpoint 5 — Coverage + final verification

**Stop here. Wait for Kevin to verify before opening a PR.**

```bash
pnpm lint
pnpm typecheck
pnpm test:run
pnpm test:coverage
pnpm build
pnpm test:e2e          # if Playwright is configured locally
```

**What this verifies:** Every defect from the Codex review has a fix backed by tests, lint+typecheck+build are green, and coverage gates are still satisfied.

---

## Coverage map (review findings → tasks)

| Review item | Task |
|---|---|
| Critical 1 — share-link actions need `requireOwner()` | 1 |
| Critical 1 — `lib/shared/proxy.ts` missing | 3 |
| Critical 2 — cron endpoints 401 | 4, 6 |
| Critical 3 — smoke schema in platform migrations | 18, 19, 20 |
| Critical 4 — `eslint.ignoreDuringBuilds: true` | 7 |
| Critical 5 — dynamic imports untyped + untested | 13, 23 |
| §1 Architectural — `loginAction` direct table import | 2 |
| §1 Architectural — HomeGrid imports `WidgetLayoutEntry` from platform | 15 |
| §1 Architectural — `save-layout-action` imports from platform | 15 |
| §1 Architectural — single Drizzle config | 18 |
| §1 Architectural — `modules/smoke/lib/public-api.ts` missing | 21 |
| §2 Security — share-link Server Actions unguarded | 1 |
| §2 Security — proxy missing | 3 |
| §2 Security — share page sets no guest session | 5 |
| §2 Security — API dispatch skips manifest | 4 |
| §3 Type-safety — `loadModuleExport` unchecked cast | 13 |
| §3 Type-safety — API handler cast | 4, 13 |
| §3 Type-safety — `widgetLayouts.layout` unchecked | 14 |
| §3 Type-safety — `saveLayoutAction` input unchecked | 15 |
| §4 Validation — eslint bypass | 7 |
| §4 Validation — env.required not enforced | 8 |
| §4 Validation — cron field ranges | 9 |
| §4 Validation — manifest path traversal | 10 |
| §4 Validation — API methods not verified | 11 |
| §5 Tests — passWithNoTests | 12 |
| §5 Tests — `module-import` untested | 13 |
| §5 Tests — `errors` untested | 23 |
| §5 Tests — share-render success path missing | 24 |
| §5 Tests — widget-render success path missing | 25 |
| §6 Race — cron 401 | 4 |
| §6 Race — `listShareLinks` shows expired | 17 |
| §6 Race — `saveLayoutAction` unvalidated | 15 |
| §6 Race — HomeGrid drag race | 16 |
| §7 Principles — `db:migrate` not ordered | 20 |
| §7 Principles — proxy missing | 3 |
| §7 Principles — boundaries location | (no-op — boundaries already live in `components/shell/boundaries/`; CLAUDE.md path is aspirational and unrelated to a real defect — flag to Kevin during checkpoint 1 review) |
| §7 Principles — API filesystem-driven | 4 |
| §7 Principles — module schema in platform migration | 19 |

---

## Out of scope (deliberate)

- Renaming `components/shell/boundaries/` to `lib/shared/boundaries.tsx`. CLAUDE.md §10.1 says boundaries live in `lib/shared/boundaries.tsx`; the actual code lives in `components/shell/boundaries/`. The behavior is correct and the boundaries are working; the location mismatch is a doc-vs-code divergence, not a defect. Resolve by either moving the files or updating CLAUDE.md — decide in a separate cleanup PR.
- Adding a typed event bus for cross-module writes (CLAUDE.md §8 explicitly defers to v2).
- Sentry / external error tracking (deferred per CLAUDE.md §3).
- Splitting platform / module migration locations into separate `__drizzle_migrations` tables. Drizzle already keys by file hash + folder; the migration tracker correctly separates them as long as each config has its own `out` path.
