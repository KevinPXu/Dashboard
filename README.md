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
pnpm new-module <id>    # optional: scaffold a new module
pnpm dev
```

Visit http://localhost:3000 — sign in with the password from `.env.local`.

See `CLAUDE.md` for the platform contract.

## Adding a module

```bash
pnpm new-module <module-id>
```

## Scripts

| Command                 | Purpose                                           |
| ----------------------- | ------------------------------------------------- |
| `pnpm dev`              | Start dev server                                  |
| `pnpm build`            | Production build                                  |
| `pnpm test`             | Run unit tests (watch)                            |
| `pnpm test:run`         | Run unit tests once                               |
| `pnpm test:coverage`    | Run unit tests with coverage                      |
| `pnpm test:integration` | Run integration tests against the Neon dev branch |
| `pnpm test:e2e`         | Run Playwright E2E tests                          |
| `pnpm lint`             | Lint                                              |
| `pnpm typecheck`        | TypeScript type check                             |
| `pnpm format`           | Format with Prettier                              |
| `pnpm format:check`     | Check Prettier formatting without writing         |
| `pnpm db:migrate`       | Run all migrations against `DATABASE_URL`         |
| `pnpm db:generate`      | Generate new migration from schema diff           |
| `pnpm db:studio`        | Open Drizzle Studio against `DATABASE_URL`        |
| `pnpm new-module`       | Scaffold a new module                             |
