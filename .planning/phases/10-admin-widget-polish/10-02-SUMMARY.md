---
phase: 10-admin-widget-polish
plan: 02
subsystem: ui
tags: [preact, admin, archive, validation, widget-preview]

# Dependency graph
requires:
  - phase: 10-01
    provides: archive/restore API endpoints (PATCH /companies/:id/archive|restore), archivedAt DB column

provides:
  - Archive/restore UI in CompanyList with showArchived toggle and dimmed rows
  - archiveCompany() and restoreCompany() API methods in api.ts
  - Inline pricing validation with validatePricing() blocking invalid saves
  - Live WidgetPreview component in BrandingSettings reacting to logoUrl and primaryColor
affects:
  - future admin UI phases
  - company management workflows

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "validatePricing() pure function returns Record<string, string> keyed by materialKey-field"
    - "WidgetPreview is a side-effect-free component driven by reactive props — no separate state"
    - "listCompanies({ includeArchived }) appends ?includeArchived=true querystring opt-in"

key-files:
  created: []
  modified:
    - packages/admin/src/api.ts
    - packages/admin/src/pages/CompanyList.tsx
    - packages/admin/src/components/BrandingSettings.tsx
    - packages/admin/src/components/PricingSettings.tsx
    - packages/admin/src/styles/admin.css

key-decisions:
  - "WidgetPreview renders inline mock (no iframe) — avoids cross-origin issues in dev and heavy asset loading"
  - "validatePricing checks: negative values, costLow >= costHigh, cost > 100, pitch > 5.0"
  - "Archive button uses window.confirm for cheap confirmation without a modal"

patterns-established:
  - "Inline validation pattern: pure validate() + validationErrors state updated on every field change"
  - "Archived row style: .company-archived (opacity 0.6) + .badge-archived pill"

requirements-completed: [COMP-01, COMP-02, PRICE-01]

# Metrics
duration: 15min
completed: 2026-03-25
---

# Phase 10 Plan 02: Admin Widget Polish Summary

**Archive/restore company UI with showArchived toggle, live WidgetPreview component in BrandingSettings, and inline pricing validation blocking bad saves**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-25T01:10:00Z
- **Completed:** 2026-03-25T01:25:00Z
- **Tasks:** 2 of 3 (Task 3 is checkpoint:human-verify — awaiting user)
- **Files modified:** 5

## Accomplishments
- CompanyList shows Archive button per active company (with confirm), Restore for archived; toggle shows archived rows dimmed with red "Archived" badge
- BrandingSettings has WidgetPreview card that mirrors company logo and brand color instantly as admin changes them
- PricingSettings validates all inputs on every change with inline error messages and blocks API save when errors exist

## Task Commits

Each task was committed atomically:

1. **Task 1: Archive/restore CompanyList + pricing validation** - `44a57a1` (feat)
2. **Task 2: Live widget preview in BrandingSettings** - `1552d61` (feat)

## Files Created/Modified
- `packages/admin/src/api.ts` - Added archivedAt to Company interface, archiveCompany(), restoreCompany(), listCompanies({ includeArchived })
- `packages/admin/src/pages/CompanyList.tsx` - showArchived toggle, Archive/Restore buttons, .company-archived rows, .badge-archived pill
- `packages/admin/src/components/BrandingSettings.tsx` - WidgetPreview component with live color/logo reactivity, new Widget Preview card
- `packages/admin/src/components/PricingSettings.tsx` - validatePricing() pure function, validationErrors state, inline .field-error messages, blocked save on errors
- `packages/admin/src/styles/admin.css` - .company-archived, .badge-archived, .btn-archive, .field-error, .widget-preview-*, .stagger-3, .btn-secondary

## Decisions Made
- WidgetPreview renders as an inline mock (not an iframe) to avoid cross-origin issues in dev and avoid loading full widget JS/CSS bundle
- validatePricing is a pure function returning `Record<string, string>` keyed by `${materialKey}-${field}` — easy to display inline per cell
- Archive confirmation uses window.confirm (no modal) — sufficient for this admin-only flow

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Archive/restore flow wired to the API endpoints added in 10-01; end-to-end ready for human verification
- Pricing validation prevents bad data before it reaches the API
- Widget preview gives admins immediate feedback on branding changes
- Task 3 (checkpoint:human-verify) awaits user confirmation before plan is marked complete

---
*Phase: 10-admin-widget-polish*
*Completed: 2026-03-25*
