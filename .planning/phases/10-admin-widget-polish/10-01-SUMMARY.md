---
phase: 10-admin-widget-polish
plan: 01
subsystem: api
tags: [drizzle, sqlite, zod, hono, cloudflare-workers]

requires:
  - phase: 08-security-foundation-tech-debt
    provides: RBAC middleware (superAdminOnly, companyAccessGuard), CSRF middleware, pagination shape
  - phase: 09-lead-management-analytics
    provides: companies table schema, admin routes foundation

provides:
  - PATCH /admin/companies/:id/archive — soft-delete with archivedAt timestamp
  - PATCH /admin/companies/:id/restore — clear archivedAt
  - GET /admin/companies excludes archived by default; includeArchived=true shows all
  - Pricing validation: costLow < costHigh, nonnegative, max $100/sqft, max 5.0 pitch multiplier
  - DB migration 0005 adding archived_at column to companies table

affects:
  - admin UI for company list (needs to show/hide archived)
  - widget phases that read company data

tech-stack:
  added: []
  patterns:
    - "Soft-delete pattern: archivedAt timestamp column, isNull filter by default, ?includeArchived=true opt-in"
    - "Zod object-level refine for cross-field validation (costLow < costHigh)"
    - "zValidator custom error handler returning { error, details } shape with 400"

key-files:
  created:
    - packages/api/drizzle/migrations/0005_add_archived_at.sql
  modified:
    - packages/api/src/db/schema.ts
    - packages/api/src/routes/admin.ts
    - packages/api/test/admin.test.ts

key-decisions:
  - "Archive uses archivedAt nullable timestamp (soft-delete), not a boolean flag — allows restoring data intact"
  - "Archive/restore endpoints are superAdminOnly — company-admin cannot archive companies"
  - "GET /companies default behavior excludes archived; opt-in via ?includeArchived=true preserves backward compat"
  - "Pricing validation uses zod nonnegative() + max() per field + object-level refine for costLow < costHigh"
  - "Error shape for pricing validation: { error: firstError.message, details: [{field, message}] } with 400"
  - "TDD test structure: each stateful scenario in its own describe block with beforeAll setup to avoid cross-test state dependencies"

patterns-established:
  - "Soft-delete: isNull(table.archivedAt) as default WHERE clause, skip when includeArchived query param present"
  - "zod refine for cross-field: .refine((data) => {...}, { message }) on object level"

requirements-completed: [COMP-01, PRICE-01]

duration: 4min
completed: 2026-03-25
---

# Phase 10 Plan 01: Admin Widget Polish - Archive/Restore & Pricing Validation Summary

**Soft-delete archive/restore for companies with archivedAt timestamp, plus Zod pricing validation enforcing costLow < costHigh, non-negative values, and $100/sqft + 5.0x pitch caps**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-03-25T00:57:12Z
- **Completed:** 2026-03-25T01:00:53Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 4

## Accomplishments

- Added `archived_at` column to companies schema with DB migration 0005
- Archive endpoint (PATCH /archive): sets archivedAt, returns 409 if already archived
- Restore endpoint (PATCH /restore): clears archivedAt, returns 409 if not archived
- GET /companies now filters out archived companies by default; `?includeArchived=true` includes them
- Pricing schema enhanced: `nonnegative()`, `max(100)` for costs, `max(5)` for pitch multipliers
- Object-level Zod refine ensures costLow < costHigh with clear error message
- All 120 tests pass (78 admin tests + 42 others)

## Task Commits

Each task was committed atomically:

1. **RED: Failing tests for archive/restore and pricing validation** - `aac444d` (test)
2. **GREEN: Archive/restore endpoints, pricing validation, archived_at schema** - `45a81b6` (feat)

_Note: TDD tasks had RED commit followed by GREEN commit. No separate refactor needed._

## Files Created/Modified

- `packages/api/src/db/schema.ts` - Added `archivedAt: text('archived_at')` to companies table
- `packages/api/drizzle/migrations/0005_add_archived_at.sql` - `ALTER TABLE companies ADD COLUMN archived_at text;`
- `packages/api/src/routes/admin.ts` - Archive/restore endpoints, isNull filter on GET /companies, enhanced pricingItemSchema with zod validations
- `packages/api/test/admin.test.ts` - 14 new tests across 6 new describe blocks for archive/restore and pricing validation

## Decisions Made

- Archive uses nullable timestamp (archivedAt) rather than boolean — preserves when company was archived and is idiomatic for soft-delete
- Archive/restore gated by `superAdminOnly` middleware — company-admin cannot self-archive
- GET /companies defaults to excluding archived (backward compatible); opt-in via `?includeArchived=true`
- Pricing error response shape: `{ error: string, details: [{field, message}] }` matches existing estimates.ts error pattern
- TDD tests that depend on state across `it()` blocks were restructured into separate `describe` blocks with `beforeAll` setup — vitest isolates state between describe blocks

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Restructured archive/restore tests from single describe to multiple describe blocks**
- **Found during:** Task 1 (GREEN phase - first test run)
- **Issue:** Tests within a single describe block that depended on state changes from earlier `it()` blocks failed — vitest Cloudflare Workers environment does not preserve DB state between individual test cases in a describe block
- **Fix:** Split into separate describe blocks (archive, re-archive, filtering, restore, re-restore), each with its own `beforeAll` that seeds fresh state
- **Files modified:** packages/api/test/admin.test.ts
- **Verification:** All 78 admin tests pass
- **Committed in:** 45a81b6 (GREEN feat commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug in test design)
**Impact on plan:** Necessary correction for test reliability. No scope creep.

## Issues Encountered

None beyond the test restructuring deviation above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Archive/restore API is complete and tested; admin UI can now implement company archive management
- Pricing validation is enforced server-side; UI can surface error messages from `{ error, details }` response
- Migration 0005 must be run against production DB before deploying archive/restore endpoints

## Self-Check: PASSED

- packages/api/src/db/schema.ts: FOUND
- packages/api/drizzle/migrations/0005_add_archived_at.sql: FOUND
- packages/api/src/routes/admin.ts: FOUND
- .planning/phases/10-admin-widget-polish/10-01-SUMMARY.md: FOUND
- Commit aac444d (RED tests): FOUND
- Commit 45a81b6 (GREEN implementation): FOUND

---
*Phase: 10-admin-widget-polish*
*Completed: 2026-03-25*
