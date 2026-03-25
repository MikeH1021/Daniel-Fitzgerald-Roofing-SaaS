---
phase: 08-security-foundation-tech-debt
plan: 02
subsystem: api
tags: [hono, drizzle-orm, sqlite, pagination, rbac, routes]

requires:
  - phase: 08-security-foundation-tech-debt/08-01
    provides: RBAC middleware (authMiddleware, superAdminOnly, companyAccessGuard), role column in companies table

provides:
  - Legacy session-scoped admin routes removed (/admin/settings, /admin/pricing, /admin/logo, /admin/embed-code return 404)
  - Company-scoped embed-code endpoint GET /admin/companies/:companyId/embed-code
  - Paginated GET /admin/companies returns { data, total, page, pageSize }
  - Paginated GET /companies (public) returns { data, total, page, pageSize }
  - New GET /admin/companies/:companyId/leads endpoint (paginated, companyAccessGuard)
  - SQL migration 0004 with indexes on leads.company_id, leads.created_at, composite

affects:
  - admin-frontend (listCompanies now returns data array from paginated response)
  - future lead-management phases (leads endpoint now exists)

tech-stack:
  added: []
  patterns:
    - "Pagination pattern: { data, total, page, pageSize } using drizzle offset/limit + count()"
    - "All list endpoints paginated with page/pageSize query params (default 20, max 100)"
    - "All admin routes are company-scoped; no session-inferred companyId in route logic"

key-files:
  created:
    - packages/api/drizzle/migrations/0004_add_indexes_and_role.sql
  modified:
    - packages/api/src/routes/admin.ts
    - packages/api/src/routes/companies.ts
    - packages/api/test/admin.test.ts
    - packages/admin/src/api.ts

key-decisions:
  - "Migration named 0004 (not 0001 as plan specified) since 0001 already existed — appended to existing sequence"
  - "debug.test.ts removed — it was an untracked debug file testing removed legacy routes; not part of the test suite"
  - "logo/settings/pricing test suites migrated to company-scoped route paths to match the new route structure"

patterns-established:
  - "Pagination: all list endpoints accept page/pageSize query params, return { data[], total, page, pageSize }"
  - "Leads access: GET /admin/companies/:companyId/leads protected by companyAccessGuard, ordered by createdAt DESC"

requirements-completed: [DEBT-01, DEBT-02, DEBT-03]

duration: 15min
completed: 2026-03-25
---

# Phase 08 Plan 02: Legacy Route Cleanup & Pagination Summary

**Legacy session-scoped admin routes removed, company-scoped embed-code added, all list endpoints paginated with drizzle offset/limit, and leads endpoint created with DB indexes**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-25T00:07:00Z
- **Completed:** 2026-03-25T00:22:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Removed 6 legacy session-scoped routes (/admin/settings, /admin/pricing, /admin/logo, /admin/embed-code and their GET/PUT/PATCH/POST variants)
- Added company-scoped GET /admin/companies/:companyId/embed-code with companyAccessGuard
- Paginated GET /admin/companies, GET /companies (public), and new GET /admin/companies/:companyId/leads
- Created migration 0004 with 3 DB indexes (company_id, created_at, composite) for leads query performance
- Updated admin frontend listCompanies() to extract .data from paginated response shape
- All 82 tests pass (46 admin tests, up from 35)

## Task Commits

1. **Task 1: Remove legacy routes, add company-scoped embed-code** - `9c06444` (feat)
2. **Task 2: Database indexes and paginated list endpoints** - `9762b69` (feat)

## Files Created/Modified

- `packages/api/src/routes/admin.ts` - Removed legacy routes, added leads endpoint, paginated companies list
- `packages/api/src/routes/companies.ts` - Paginated public companies list
- `packages/api/drizzle/migrations/0004_add_indexes_and_role.sql` - Indexes on leads table
- `packages/api/test/admin.test.ts` - Updated to company-scoped routes, added pagination and leads tests
- `packages/admin/src/api.ts` - listCompanies() handles paginated response

## Decisions Made

- Migration numbered 0004 (plan said 0001) because 0001 already existed from prior schema changes — appended to sequence
- Removed untracked `debug.test.ts` file that was testing removed legacy routes; Rule 1 auto-fix
- Test suites for settings/pricing/logo migrated from legacy paths to company-scoped paths to keep coverage intact

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed debug.test.ts testing removed legacy route**
- **Found during:** Task 2 (full test suite run)
- **Issue:** `test/debug.test.ts` was an untracked debug file that tested `GET /api/admin/pricing` (now 404) and was failing the full suite
- **Fix:** Removed the file — it was an exploratory debug file, not a real test, and tested functionality that no longer exists
- **Files modified:** packages/api/test/debug.test.ts (deleted)
- **Verification:** Full suite runs 82 tests, all pass
- **Committed in:** 9762b69 (Task 2 commit)

**2. [Rule 1 - Bug] Updated logo test error message assertions**
- **Found during:** Task 1 (GREEN phase, test run)
- **Issue:** Tests expected old legacy handler error messages ("1MB", "image") but company-scoped handler returns shorter messages ("File too large", "Invalid file type")
- **Fix:** Changed assertions to use regex `/too large|1MB/i` and `/invalid file type|image/i` to match either format
- **Files modified:** packages/api/test/admin.test.ts
- **Verification:** Logo tests pass
- **Committed in:** 9c06444 (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs)
**Impact on plan:** Both fixes necessary for correct test behavior. No scope creep.

## Issues Encountered

None — implementation was straightforward. The plan's reference to migration filename `0001_add_indexes_and_role.sql` conflicted with existing `0001_strange_landau.sql`; resolved by using next available number `0004`.

## Next Phase Readiness

- All legacy routes gone — admin frontend operates exclusively on company-scoped routes
- Leads endpoint ready for lead management UI (Phase 9+)
- DB indexes in place for performant leads queries as data scales
- Pagination shape established consistently across all list endpoints

---
*Phase: 08-security-foundation-tech-debt*
*Completed: 2026-03-25*
