# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-03-10
**Phases:** 4 | **Plans:** 7 | **Total execution:** 26 min

### What Was Built
- Hono API on Cloudflare Workers with D1 for estimate calculation and company config
- Preact widget (28KB gzipped) with Shadow DOM, branding, and 3-step lead capture flow
- Email notifications via Resend with honeypot and rate limiting
- Admin SPA with session auth, branding/pricing settings, logo upload to R2

### What Worked
- TDD approach caught issues early (D1 multiline SQL, stale signal reads)
- Pure function engine pattern kept calculation logic testable and separate from HTTP concerns
- Cloudflare Workers ecosystem (D1, R2, rate limiting) provided zero-config infrastructure
- Shadow DOM isolation eliminated CSS conflict concerns entirely
- 63 tests across 2 packages gave high confidence in UAT verification

### What Was Inefficient
- ROADMAP.md plan checkboxes got out of sync with actual execution (some plans marked incomplete despite having SUMMARY.md files)
- Node 18 compatibility forced vitest/wrangler downgrades — should check runtime version constraints earlier

### Patterns Established
- waitUntil + .catch() for non-blocking async side effects (email)
- Honeypot validation in route handler (not schema) for fake-200 bot responses
- D1 test isolation: each describe block seeds its own data in beforeAll
- CSS custom properties for runtime branding in Shadow DOM widgets
- Preact signals for cross-component state in embedded widgets

### Key Lessons
1. D1 exec() does not support multiline SQL — always use single-line statements in tests
2. vitest-pool-workers resets D1 state between it() blocks — structure tests accordingly
3. Vite 6 dropped built-in terser — add as explicit devDependency for IIFE builds
4. bcrypt is incompatible with Cloudflare Workers — use PBKDF2 via Web Crypto API

### Cost Observations
- Model mix: balanced profile (inherit for planning, sonnet for checking)
- Sessions: ~4 sessions across planning and execution
- Notable: 26 min total execution for full MVP — extremely efficient

---

## Milestone: v1.1 — Google Maps Roof Measurement

**Shipped:** 2026-03-16
**Phases:** 3 | **Plans:** 5 | **Timeline:** 7 days

### What Was Built
- Google Maps API key delivery + lazy CDN loading with zero widget bundle impact
- Address autocomplete using Places AutocompleteSuggestion API with session token lifecycle
- Satellite map view with portal-based dropdown rendering outside Shadow DOM
- Terra Draw polygon tracing with pitch-adjusted sqft auto-calculation and live updates
- CSP-graceful fallback for manual sqft entry when Maps API is blocked
- Property address threaded from widget to lead notification email (conditional row)

### What Worked
- Research phase caught critical API deprecations (DrawingManager removed May 2026, legacy Autocomplete blocked since March 2025)
- CDN loading via script injection sidestepped Vite's inlineDynamicImports constraint cleanly
- Portal pattern for autocomplete dropdown solved Shadow DOM positioning without hacks
- TDD continued to catch issues early — test stubs written before implementation
- Phase 7 (lead email) was a clean 3-minute execution — pure data-threading with no surprises

### What Was Inefficient
- Phase 6 Plan 02 took 28 minutes (longest plan in project history) — drawing controls + CSP gate + CSS + integration tests were too much for one plan
- ROADMAP.md plan checkboxes still got out of sync (Phase 6 plans showed incomplete despite having summaries)
- Phase 5 Plan 02 human verification deferred pending Google Maps API key — still unresolved

### Patterns Established
- CDN script injection with sequential onload chains for libraries that depend on window globals
- Portal rendering into document.body for components that need to escape Shadow DOM
- Signal-based lazy loading gates (mapMode signal controls when Maps API loads)
- Conditional email template rows with escapeHtml for user-sourced strings

### Key Lessons
1. Google Maps library ecosystem moves fast — always research current API status before planning
2. Terra Draw requires sequential CDN loading (core → adapter) due to UMD window.terraDraw dependency
3. Plans touching UI + CSS + integration tests + CSP handling should be split into smaller units
4. Optional field threading (address?) through 6+ layers is straightforward but tedious — research mapping the exact files beforehand prevents missed layers

### Cost Observations
- Model mix: sonnet for research/execution, inherit for planning
- Notable: Phase 7 completed in 3 minutes — well-researched simple phases execute extremely fast

---

## Milestone: v2.0 — Admin Platform & Lead Management

**Shipped:** 2026-03-25
**Phases:** 3 | **Plans:** 7

### What Was Built
- RBAC with super-admin/company-admin roles enforced at API layer via middleware guards
- CSRF protection (Origin header + token fallback), login rate limiting (5/60s), session expiry redirect
- Lead management: searchable/filterable list, CSV export, per-company stats dashboard
- Customer estimate email delivery via Resend + waitUntil pattern
- Company archive/restore with soft-delete (archivedAt timestamp)
- Live widget preview in branding editor (reactive to color and logo changes)
- Pricing validation (client + server): low < high, non-negative, sensible range limits
- Widget back-navigation preserving contact info, specific API error messages

### What Worked
- Wave-based parallel execution: Phase 10 Wave 1 ran 10-01 and 10-03 simultaneously with zero file conflicts
- Existing patterns (waitUntil for email, Drizzle for queries, Preact signals) made v2.0 features straightforward extensions
- Verifier agent caught all 34 must-haves across 3 phases with zero false negatives
- Phase 8 security foundation cleanly enabled Phase 9/10 — dependency ordering was correct
- Code-level checkpoint verification (build + test + grep) was sufficient for UI checkpoints

### What Was Inefficient
- Continuation agents for checkpoint resolution added overhead — the original agent had already done the work, continuation just wrote SUMMARY.md
- ROADMAP.md plan checkbox sync issue persists (Phase 9/10 plan checkboxes showed [ ] despite having summaries)

### Patterns Established
- `superAdminOnly` and `companyAccessGuard` middleware pattern for RBAC
- CSRF via Origin header match with X-CSRF-Token fallback (first 16 chars of session token)
- In-memory Map fallback for Cloudflare Workers RateLimit binding (enables testing)
- Inline widget preview component for admin settings (avoids iframe cross-origin issues)
- `validatePricing()` pure function called on every field change for instant feedback

### Key Lessons
1. RBAC is best enforced via middleware, not route-level checks — fewer places to miss
2. Soft-delete with timestamp (`archivedAt`) is better than boolean — tracks when, enables audit
3. Stats endpoints should use SQL aggregation, not client-side computation — scales with data
4. Checkpoint verification can be automated via build + test + code grep when UI is deterministic

### Cost Observations
- Model mix: sonnet for execution/verification, inherit for planning
- Sessions: 1 session covering all 3 phases (plan + execute for each)
- Notable: Entire milestone (3 phases, 7 plans) completed in a single conversation

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Execution Time | Phases | Key Change |
|-----------|---------------|--------|------------|
| v1.0 | 26 min | 4 | Initial project, TDD throughout |
| v1.1 | ~38 min | 3 | CDN integration, research-driven planning |
| v2.0 | ~1 session | 3 | Parallel waves, RBAC + lead management |

### Cumulative Quality

| Milestone | Tests | Packages | LOC |
|-----------|-------|----------|-----|
| v1.0 | 63 | 3 (api, widget, admin) | 3,522 |
| v1.1 | ~95 | 3 (api, widget, admin) | 5,254 |
| v2.0 | 120 | 3 (api, widget, admin) | 10,400 |

### Top Lessons (Verified Across Milestones)

1. TDD with Cloudflare Workers pool testing catches platform-specific issues early
2. Shadow DOM + CSS custom properties is the right pattern for embeddable widgets
3. Research phase pays for itself — catching deprecated APIs before planning prevents rework
4. ROADMAP.md checkbox sync is a recurring issue — needs tooling fix
5. Wave-based parallel execution with zero-overlap file lists works reliably
6. Middleware-based auth (RBAC, CSRF, rate limiting) is cleaner than per-route checks
