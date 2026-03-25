# Milestones

## v2.0 Admin Platform & Lead Management (Shipped: 2026-03-25)

**Phases completed:** 3 phases, 7 plans, 2 tasks

**Key accomplishments:**
- (none recorded)

---

## v1.1 Google Maps Roof Measurement (Shipped: 2026-03-16)

**Phases completed:** 3 phases, 5 plans
**Timeline:** 2026-03-09 to 2026-03-16 (7 days)
**Lines added:** 5,633 across 50 files
**Total codebase:** ~5,254 LOC TypeScript/CSS/SQL

**Key accomplishments:**
- Google Maps API key delivery via Worker secret + lazy CDN loading (zero widget size impact)
- Address autocomplete with Places AutocompleteSuggestion API and session token lifecycle (cost-controlled)
- Satellite map view with portal-based dropdown rendering outside Shadow DOM
- Terra Draw polygon tracing with pitch-adjusted sqft auto-calculation and live updates
- CSP-graceful fallback — manual sqft entry works when Maps API is blocked by host site
- Property address from map mode threaded to lead notification email (conditional row, HTML-escaped)

**Tech added:** Google Maps JS API (CDN), Terra Draw (CDN), Google Places AutocompleteSuggestion API

---

## v1.0 MVP (Shipped: 2026-03-10)

**Phases completed:** 4 phases, 7 plans
**Timeline:** 2026-03-09 to 2026-03-10 (2 days)
**Lines of code:** 3,522 TypeScript/TSX/CSS
**Files:** 102 files created
**Total execution time:** 26 min (0.43 hours)

**Key accomplishments:**
- Hono API on Cloudflare Workers with D1 database, Zod validation, and TDD-verified estimate engine
- Preact widget with Shadow DOM isolation, company branding, and responsive 3-step form (28KB gzipped IIFE)
- Lead capture with TCPA-compliant consent, contact form validation, and D1 storage
- Email notifications via Resend API with honeypot bot protection and rate limiting
- PBKDF2 session auth with admin SPA for branding, pricing overrides, and embed code
- Logo upload to R2 with type/size validation and public serving

**Tech stack:** Hono, Cloudflare Workers, D1, R2, Drizzle ORM, Preact, Vite, Zod, Resend API

---

