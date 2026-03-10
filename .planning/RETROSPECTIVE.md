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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Execution Time | Phases | Key Change |
|-----------|---------------|--------|------------|
| v1.0 | 26 min | 4 | Initial project, TDD throughout |

### Cumulative Quality

| Milestone | Tests | Packages | LOC |
|-----------|-------|----------|-----|
| v1.0 | 63 | 3 (api, widget, admin) | 3,522 |

### Top Lessons (Verified Across Milestones)

1. TDD with Cloudflare Workers pool testing catches platform-specific issues early
2. Shadow DOM + CSS custom properties is the right pattern for embeddable widgets
