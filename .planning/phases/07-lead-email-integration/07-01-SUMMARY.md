---
phase: 07-lead-email-integration
plan: 01
subsystem: api
tags: [drizzle, zod, email, preact, lead-capture, d1]

# Dependency graph
requires:
  - phase: 05-google-maps-autocomplete
    provides: selectedPlace signal with formattedAddress from map autocomplete
  - phase: 03-lead-delivery
    provides: lead notification email template and sendLeadNotification
provides:
  - Optional address column in leads DB table (via migration 0002)
  - Conditional Property Address row in lead notification email HTML
  - address field threaded from widget selectedPlace through API to email
affects: [future phases using lead data, admin lead views]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Conditional template interpolation in email HTML using ternary expressions
    - Nullable column via Drizzle (no .notNull()) defaulting to null on insert when field absent
    - Widget signals read in handleSubmit at call time (selectedPlace.value?.formattedAddress)

key-files:
  created:
    - packages/api/drizzle/migrations/0002_faulty_iron_monger.sql
    - packages/api/drizzle/migrations/meta/0002_snapshot.json
  modified:
    - packages/api/src/db/schema.ts
    - packages/api/src/validation/schemas.ts
    - packages/api/src/routes/estimates.ts
    - packages/api/src/email/lead-email-template.ts
    - packages/widget/src/api/client.ts
    - packages/widget/src/components/ContactInfo.tsx
    - packages/api/test/lead-notification.test.ts
    - packages/api/test/estimates.test.ts

key-decisions:
  - "address field is optional at every layer — DB nullable, Zod optional, widget uses || undefined — manual-entry submissions unchanged"
  - "escapeHtml applied to address in email template (addresses can contain & e.g. '1st & Main')"
  - "selectedPlace.value?.formattedAddress || undefined used in ContactInfo (not || null) so undefined omits from JSON.stringify"

patterns-established:
  - "TDD RED/GREEN: write failing tests first, then implement to pass"
  - "Test DB schema must include new columns in CREATE TABLE IF NOT EXISTS statements"

requirements-completed: [LEAD-01]

# Metrics
duration: 3min
completed: 2026-03-16
---

# Phase 7 Plan 01: Lead Email Integration Summary

**Nullable address column added to leads DB, conditional Property Address row in lead email, with address threaded from widget map autocomplete (selectedPlace.formattedAddress) through Zod validation, D1 insert, and email template.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-16T16:09:32Z
- **Completed:** 2026-03-16T16:12:50Z
- **Tasks:** 2 (TDD RED + GREEN)
- **Files modified:** 9

## Accomplishments
- Added `address text` nullable column to leads table via Drizzle migration 0002
- Email template now shows "Property Address" row only when address is present (escapeHtml applied)
- Widget ContactInfo reads `selectedPlace.value?.formattedAddress` and passes to API on submit
- 4 new tests added (email HTML with/without address, DB stores/omits address) — all pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing tests for address in email template and API storage** - `6460e68` (test)
2. **Task 2: Thread address through all layers** - `dcc7a3d` (feat)

**Plan metadata:** (final docs commit — see below)

_Note: TDD tasks have two commits (test RED → feat GREEN)_

## Files Created/Modified
- `packages/api/drizzle/migrations/0002_faulty_iron_monger.sql` - ALTER TABLE leads ADD COLUMN address text
- `packages/api/drizzle/migrations/meta/0002_snapshot.json` - Updated Drizzle snapshot
- `packages/api/src/db/schema.ts` - Added `address: text('address')` (nullable) to leads table
- `packages/api/src/validation/schemas.ts` - Added `address: z.string().max(500).optional()`
- `packages/api/src/routes/estimates.ts` - address passed to DB insert (??null) and email lead object
- `packages/api/src/email/lead-email-template.ts` - `address?` on LeadEmailData, conditional Property Address row
- `packages/widget/src/api/client.ts` - `address?` added to submitEstimate parameter type
- `packages/widget/src/components/ContactInfo.tsx` - Import selectedPlace, pass formattedAddress to submitEstimate
- `packages/api/test/lead-notification.test.ts` - 2 new tests: address present/absent in email HTML
- `packages/api/test/estimates.test.ts` - 2 new tests: address stored/null in DB; leads CREATE TABLE updated with address column

## Decisions Made
- `address` is optional at every layer — DB nullable, Zod `.optional()`, widget uses `|| undefined` — manual-entry submissions are completely unchanged
- `escapeHtml` applied to address value in email template (addresses can contain `&` e.g. "1st & Main")
- `selectedPlace.value?.formattedAddress || undefined` rather than `|| null` so undefined values are omitted by JSON.stringify, keeping the payload clean for non-map submissions
- Pre-existing TypeScript error in `packages/api/src/routes/admin.ts:108` (instanceof expression type error) is out of scope and deferred — was present before this plan

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Pre-existing TypeScript error in admin.ts (unrelated to this plan) — confirmed pre-existing via `git stash` verification, deferred to deferred-items

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- LEAD-01 requirement fully addressed: address flows from map autocomplete to lead email
- Roofing company receives Property Address row in email when homeowner used map mode
- Manual-entry submissions produce no Property Address row and null DB value (backward compatible)
- Phase 7 plan 01 complete — remaining phases in this series can build on address data in leads table

---
*Phase: 07-lead-email-integration*
*Completed: 2026-03-16*
