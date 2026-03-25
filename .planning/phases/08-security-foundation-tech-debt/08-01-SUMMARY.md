---
phase: 08-security-foundation-tech-debt
plan: 01
subsystem: auth
tags: [rbac, csrf, rate-limiting, hono, cloudflare-workers, drizzle]

requires:
  - phase: 06-admin-platform
    provides: admin routes, session management, company schema

provides:
  - RBAC enforcement: super-admin full access, company-admin scoped to own company
  - CSRF protection middleware for all state-changing admin endpoints
  - Login rate limiting (5 attempts per 60s per IP) with CF Workers binding + in-memory fallback
  - Frontend 401 auto-redirect to login on session expiry
  - X-CSRF-Token header on all mutations in admin frontend
  - GET /api/admin/me endpoint replacing session-based /api/admin/settings for auth checks
  - GET /api/admin/csrf-token endpoint for frontend token fetching

affects:
  - 08-02
  - 09-lead-management

tech-stack:
  added: []
  patterns:
    - "RBAC via role column on companies table, enforced server-side in middleware"
    - "CSRF via Origin header check OR X-CSRF-Token = first 16 chars of session token"
    - "Rate limiting with Cloudflare RateLimit binding + in-memory Map fallback for tests"
    - "TDD: RED (failing tests committed), then GREEN (implementation committed)"

key-files:
  created:
    - packages/api/src/middleware/csrf.ts
    - packages/api/src/middleware/rate-limit.ts
    - packages/api/src/routes/companies.ts
  modified:
    - packages/api/src/db/schema.ts
    - packages/api/src/auth/session.ts
    - packages/api/src/middleware/auth.ts
    - packages/api/src/routes/admin.ts
    - packages/api/src/types.ts
    - packages/api/src/index.ts
    - packages/api/wrangler.toml
    - packages/api/test/admin.test.ts
    - packages/admin/src/api.ts
    - packages/admin/src/App.tsx
    - packages/admin/src/components/BrandingSettings.tsx
    - packages/admin/src/components/EmbedCode.tsx
    - packages/admin/src/components/PricingSettings.tsx

key-decisions:
  - "CSRF token = first 16 chars of session token (session is nanoid(32)); avoids separate token store while being secure enough"
  - "Rate limiter uses Cloudflare Workers binding in production with in-memory Map fallback for local dev/test to enable testability"
  - "Role stored in companies table (not sessions); JOIN in validateSession returns role so auth middleware gets it in a single query"
  - "companyAccessGuard allows super-admin through unconditionally; company-admin must match :companyId param"
  - "Legacy api.ts methods removed entirely (getSettings, updateSettings, etc.) to prevent dead code and force migration to company-scoped routes"

patterns-established:
  - "Auth middleware chain: authMiddleware -> csrfMiddleware -> role guard (superAdminOnly or companyAccessGuard)"
  - "Frontend 401 interception: any non-login/setup request returning 401 triggers window.location.replace('/admin')"
  - "CSRF token cached at module level in frontend; cleared on logout"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

duration: 25min
completed: 2026-03-25
---

# Phase 8 Plan 01: RBAC, CSRF, Rate Limiting, and Session Expiry Summary

**RBAC enforced server-side via role column on companies table with CSRF protection and rate-limited login using Cloudflare Workers RateLimit binding with in-memory fallback**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-03-25T00:00:00Z
- **Completed:** 2026-03-25T00:25:00Z
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments

- Role-based access control: super-admin can CRUD all companies, company-admin restricted to own company, enforced server-side in middleware
- CSRF protection on all state-changing admin endpoints (POST/PATCH/PUT/DELETE) via Origin header check or X-CSRF-Token header
- Login rate limiting at 5 attempts per 60 seconds per IP using Cloudflare Workers RateLimit binding with in-memory fallback for tests
- Frontend auto-redirects to login on 401 from any API call (session expiry)
- All admin frontend mutations include X-CSRF-Token header fetched lazily from /api/admin/csrf-token
- Legacy session-scoped API methods removed from frontend; all operations now use company-scoped routes

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: failing tests for RBAC, rate-limiting, CSRF** - `cb39f85` (test)
2. **Task 1 GREEN: implement RBAC, CSRF, and rate limiting middleware** - `708f89a` (feat)
3. **Task 2: frontend session expiry redirect and CSRF token integration** - `7925321` (feat)

## Files Created/Modified

- `packages/api/src/middleware/csrf.ts` - CSRF middleware checking Origin header or X-CSRF-Token against session
- `packages/api/src/middleware/rate-limit.ts` - Login rate limiter with CF Workers binding + in-memory fallback
- `packages/api/src/routes/companies.ts` - New companies route module wired into main app
- `packages/api/src/db/schema.ts` - Added role column (company-admin default, super-admin option)
- `packages/api/src/auth/session.ts` - validateSession now returns { companyId, role } via JOIN
- `packages/api/src/middleware/auth.ts` - AdminVars expanded with role and sessionToken; added superAdminOnly and companyAccessGuard
- `packages/api/src/routes/admin.ts` - Applied loginRateLimiter, csrfMiddleware, RBAC guards; added /me and /csrf-token endpoints
- `packages/api/src/types.ts` - Added LOGIN_RATE_LIMITER to Bindings
- `packages/api/wrangler.toml` - Added LOGIN_RATE_LIMITER rate limit binding
- `packages/api/test/admin.test.ts` - Updated seedAdminData with role column; added RBAC, rate limit, CSRF tests
- `packages/admin/src/api.ts` - 401 interceptor, CSRF token caching, X-CSRF-Token on mutations, checkSession via /me, legacy methods removed
- `packages/admin/src/App.tsx` - role in auth state, conditional Companies nav, company-admin redirect to own company
- `packages/admin/src/components/BrandingSettings.tsx` - Removed legacy API method fallbacks
- `packages/admin/src/components/EmbedCode.tsx` - Removed legacy getEmbedCode() call
- `packages/admin/src/components/PricingSettings.tsx` - Removed legacy getPricing/updatePricing fallbacks

## Decisions Made

- CSRF token = first 16 chars of session token: avoids separate token store while still being random enough (session is nanoid(32))
- Rate limiter uses Cloudflare Workers binding in production with in-memory Map fallback for testability
- Role stored in companies table and retrieved via JOIN in validateSession — single query, no extra lookup
- Legacy API methods removed entirely from api.ts to eliminate dead code and force full migration to company-scoped routes

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated components relying on removed legacy API methods**
- **Found during:** Task 2 (frontend changes)
- **Issue:** After removing legacy API methods from api.ts, BrandingSettings, EmbedCode, and PricingSettings still referenced getSettings(), uploadLogo(), getPricing(), updatePricing(), getEmbedCode() — causing TypeScript compile errors
- **Fix:** Updated all three components to use only the company-scoped API paths (require companyId to be passed); removed dead else-branches that fell back to legacy methods
- **Files modified:** packages/admin/src/components/BrandingSettings.tsx, EmbedCode.tsx, PricingSettings.tsx
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 7925321 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed aria-hidden type incompatibility in NavIcon svgProps**
- **Found during:** Task 2 (TypeScript compile check)
- **Issue:** aria-hidden was typed as 'string' but Preact's SVGAttributes expected Booleanish
- **Fix:** Changed 'true' to true as const in svgProps
- **Files modified:** packages/admin/src/App.tsx
- **Verification:** npx tsc --noEmit passes cleanly
- **Committed in:** 7925321 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug)
**Impact on plan:** Both fixes were necessary for TypeScript to compile. The component updates were required by removing the legacy methods as planned. No scope creep.

## Issues Encountered

- `debug.test.ts` (an untracked debug file not part of the plan) fails because it calls `/api/admin/pricing` without an Origin header — this now correctly returns 403 since CSRF is applied. This is a pre-existing debug file, not a regression in planned test coverage. All 35 tests in `admin.test.ts` pass.

## Next Phase Readiness

- RBAC, CSRF, rate limiting, and session expiry are all production-ready
- Phase 08-02 can build on the RBAC foundation to implement lead management
- The /api/admin/me endpoint is available for the frontend to use for role-based UI decisions
- Legacy session-scoped routes still exist for backward compatibility but should be removed in plan 02

---
*Phase: 08-security-foundation-tech-debt*
*Completed: 2026-03-25*
