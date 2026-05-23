# Smoke Test (smoke)

Validates the platform end-to-end

## Files

- `module.config.ts` — manifest
- `routes/` — pages mounted at `/smoke/*`
- `api/` — API handlers mounted at `/api/smoke/*`
- `lib/` — module-private logic (TDD-strict, ≥80% coverage)
- `db/` — Drizzle schema + migrations
- `widgets/` — home-page widgets owned by this module
- `tests/` — integration tests
