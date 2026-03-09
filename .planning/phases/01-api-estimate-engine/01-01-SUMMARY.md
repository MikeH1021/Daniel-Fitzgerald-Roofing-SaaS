---
phase: 01-api-estimate-engine
plan: 01
subsystem: api
tags: [hono, cloudflare-workers, d1, drizzle, zod, vitest, estimate-engine]

# Dependency graph
requires: []
provides:
  - "Hono project scaffold with Cloudflare Workers config"
  - "Drizzle schema: companies and pricing_overrides tables with migration"
  - "Zod validation schema for estimate requests"
  - "Pure calculateEstimate function (sqft x pitch x complexity x material)"
  - "Default pricing constants (materials, pitch multipliers)"
  - "Vitest test infrastructure with Cloudflare Workers pool"
affects: [01-02, 01-03, 02-widget, 03-admin]

# Tech tracking
tech-stack:
  added: [hono@4, drizzle-orm@0.45, zod@3, nanoid@5, vitest@2.1, wrangler@3, "@cloudflare/vitest-pool-workers@0.5", "@hono/zod-validator"]
  patterns: [pure-function-engine, schema-as-code-drizzle, zod-request-validation, workers-pool-testing]

key-files:
  created:
    - packages/api/src/engine/calculate.ts
    - packages/api/src/engine/defaults.ts
    - packages/api/src/types.ts
    - packages/api/src/db/schema.ts
    - packages/api/src/db/index.ts
    - packages/api/src/validation/schemas.ts
    - packages/api/src/index.ts
    - packages/api/test/engine.test.ts
    - packages/api/vitest.config.ts
    - packages/api/wrangler.toml
    - packages/api/drizzle.config.ts
    - packages/api/drizzle/migrations/0000_fast_silhouette.sql
  modified: []

key-decisions:
  - "Downgraded vitest to 2.1.x and wrangler to 3.x for Node 18 compatibility"
  - "Complexity multiplier set to 1.0 for v1 (formula includes it for v2 future-proofing)"

patterns-established:
  - "Pure function engine: calculation logic separated from HTTP/DB concerns"
  - "Drizzle schema-as-code with generated SQL migrations"
  - "Zod schemas defined separately for reuse across routes and widget"

requirements-completed: [EST-04, EST-05, EST-06]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 1 Plan 01: Project Scaffold + Estimate Engine Summary

**Hono API scaffold with Drizzle D1 schema, Zod validation, and TDD-verified estimate calculation engine producing rounded price ranges**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T21:06:35Z
- **Completed:** 2026-03-09T21:10:11Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Scaffolded complete Hono + Cloudflare Workers project with D1 bindings, CORS, and health check
- Defined Drizzle schema for companies and pricing_overrides tables with generated migration
- Built and tested pure estimate calculation engine with 7 passing test cases covering formula accuracy, rounding, material comparisons, pitch scaling, disclaimer, and config overrides

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold Hono project** - `4398d58` (feat)
2. **Task 2 RED: Failing engine tests** - `78ea150` (test)
3. **Task 2 GREEN: Implement engine** - `5b08c25` (feat)

## Files Created/Modified
- `packages/api/package.json` - Project config with all dependencies
- `packages/api/tsconfig.json` - TypeScript config (ESNext, bundler resolution, strict)
- `packages/api/wrangler.toml` - Cloudflare Workers config with D1 binding
- `packages/api/drizzle.config.ts` - Drizzle Kit config for SQLite dialect
- `packages/api/vitest.config.ts` - Vitest with Cloudflare Workers pool
- `packages/api/src/index.ts` - Hono app entry with CORS and health check
- `packages/api/src/types.ts` - Shared types: Bindings, PricingConfig, EstimateResult, EstimateRequest
- `packages/api/src/db/schema.ts` - Drizzle schema: companies and pricing_overrides tables
- `packages/api/src/db/index.ts` - createDb factory function
- `packages/api/src/validation/schemas.ts` - Zod schema: sqft 100-10000, pitch/material enums, companyId
- `packages/api/src/engine/defaults.ts` - Default material costs, pitch multipliers, complexity=1.0
- `packages/api/src/engine/calculate.ts` - Pure calculateEstimate function
- `packages/api/test/engine.test.ts` - 7 unit tests for calculation engine
- `packages/api/test/tsconfig.json` - Test TypeScript config
- `packages/api/test/env.d.ts` - Cloudflare test binding type declarations
- `packages/api/drizzle/migrations/0000_fast_silhouette.sql` - Initial migration SQL

## Decisions Made
- Downgraded vitest to ~2.1.0 and wrangler to ^3.99.0 because Node 18 (system version) lacks crypto.hash needed by Vite 7 / vitest 3.x. This is a runtime compatibility constraint, not an architectural choice.
- Complexity multiplier is 1.0 for v1 per research recommendation. The formula multiplies by it for future-proofing (v2 EST-07), but the API does not accept it as input.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Downgraded vitest/wrangler for Node 18 compatibility**
- **Found during:** Task 2 (TDD RED phase)
- **Issue:** vitest 3.x pulls vite 7.x which requires crypto.hash (Node 20+). System has Node 18.19.1.
- **Fix:** Pinned vitest to ~2.1.0, @cloudflare/vitest-pool-workers to ^0.5.0, wrangler to ^3.99.0
- **Files modified:** packages/api/package.json, packages/api/package-lock.json
- **Verification:** All 7 tests pass with vitest 2.1.9
- **Committed in:** 78ea150 (RED phase commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Version downgrade necessary for Node 18 compatibility. No functional impact -- all features work as specified.

## Issues Encountered
None beyond the version compatibility deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Project scaffold complete, ready for Plan 02 (API endpoints wiring)
- estimate engine is a pure function importable by route handlers
- Drizzle schema ready for company config lookup
- Zod schemas ready for request validation middleware

## Self-Check: PASSED

All 12 key files verified present. All 3 task commits verified in git log.

---
*Phase: 01-api-estimate-engine*
*Completed: 2026-03-09*
