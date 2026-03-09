---
phase: 02-embeddable-widget
plan: 02
subsystem: api, ui
tags: [preact, hono, drizzle, d1, zod, lead-capture, tcpa, contact-form]

# Dependency graph
requires:
  - phase: 02-embeddable-widget/01
    provides: Widget scaffold with Shadow DOM, branding, state management, and API client
  - phase: 01-api-estimate-engine
    provides: Estimate calculation engine, pricing overrides, D1 schema
provides:
  - Lead capture contact form with TCPA consent in embeddable widget
  - Leads table in D1 for storing homeowner contact info with consent
  - Extended estimates API accepting optional contact fields
  - End-to-end flow from roof details through contact to estimate display
affects: [03-admin-dashboard, 04-deployment]

# Tech tracking
tech-stack:
  added: [nanoid (for lead IDs)]
  patterns: [zod superRefine for conditional validation, signal-driven form with inline validation]

key-files:
  created:
    - packages/widget/src/components/ContactInfo.tsx
    - packages/widget/test/contact.test.ts
    - packages/api/drizzle/migrations/0001_strange_landau.sql
  modified:
    - packages/api/src/validation/schemas.ts
    - packages/api/src/db/schema.ts
    - packages/api/src/routes/estimates.ts
    - packages/api/src/types.ts
    - packages/api/test/estimates.test.ts
    - packages/widget/src/components/EstimateDisplay.tsx
    - packages/widget/src/App.tsx

key-decisions:
  - "Used zod superRefine for conditional all-or-nothing contact field validation"
  - "Consent text generated server-side with company name lookup for TCPA compliance"
  - "Lead storage is a side effect of estimate POST -- no separate endpoint needed"

patterns-established:
  - "Conditional validation: superRefine checks field group completeness"
  - "Inline validation: rc-error divs below each field, validated on submit click"
  - "Signal-driven form: errors stored in local signal, cleared on re-validate"

requirements-completed: [LEAD-01, LEAD-02, WIDG-03]

# Metrics
duration: 3min
completed: 2026-03-09
---

# Phase 2 Plan 2: Lead Capture Summary

**Contact form with TCPA consent, leads table in D1, and end-to-end submission wiring from widget to API**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T23:48:50Z
- **Completed:** 2026-03-09T23:52:29Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments
- Contact form with firstName, lastName, email (type=email), phone (type=tel) inputs bound to Preact signals
- TCPA consent checkbox unchecked by default, label includes company name, blocks submission when unchecked
- API extended with optional contact fields using zod superRefine conditional validation
- Leads table added to D1 with drizzle migration, stores lead records when consent given
- End-to-end flow complete: roof details -> contact info -> API submission -> estimate display
- All 30 tests passing (21 API + 9 widget), IIFE bundle builds at 28KB gzipped

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend API with leads table and contact field support** - `48b4216` (feat)
2. **Task 2: Complete ContactInfo form with consent and wire end-to-end submission** - `a5564c4` (feat)

_Both tasks used TDD: tests written first (RED), then implementation (GREEN)._

## Files Created/Modified
- `packages/widget/src/components/ContactInfo.tsx` - Full contact form with validation and TCPA consent
- `packages/widget/src/components/EstimateDisplay.tsx` - Updated with loading state and full reset
- `packages/widget/src/App.tsx` - Passes companyId prop to ContactInfo
- `packages/widget/test/contact.test.ts` - 4 tests: fields, consent, submit, validation
- `packages/api/src/validation/schemas.ts` - Extended with optional contact fields and superRefine
- `packages/api/src/db/schema.ts` - Added leads table schema
- `packages/api/src/routes/estimates.ts` - Lead storage when contact fields + consent present
- `packages/api/src/types.ts` - Extended EstimateRequest interface
- `packages/api/test/estimates.test.ts` - 4 new lead capture tests
- `packages/api/drizzle/migrations/0001_strange_landau.sql` - CREATE TABLE leads migration

## Decisions Made
- Used zod superRefine for conditional all-or-nothing contact field validation (cleaner than separate schemas)
- Consent text generated server-side with company name lookup for TCPA compliance
- Lead storage is a side effect of the estimate POST endpoint -- no separate endpoint needed for v1

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 2 complete: embeddable widget with full lead capture flow ready
- Widget builds as single 28KB IIFE bundle for embedding
- Admin dashboard (Phase 3) can query leads table for lead management
- Deployment (Phase 4) will serve the widget JS from the API worker

---
*Phase: 02-embeddable-widget*
*Completed: 2026-03-09*
