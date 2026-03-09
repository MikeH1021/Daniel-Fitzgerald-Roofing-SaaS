---
phase: 02-embeddable-widget
plan: 01
subsystem: ui
tags: [preact, shadow-dom, vite, iife, signals, widget, css-isolation]

# Dependency graph
requires:
  - phase: 01-api-estimate-engine
    provides: GET /api/config/:companyId and POST /api/estimates endpoints
provides:
  - Widget package with Preact + Vite IIFE build pipeline
  - Shadow DOM entry point reading data-company-id from script tag
  - Multi-step form UI (roof details, contact placeholder, estimate display)
  - Company branding (logo, primaryColor) via CSS custom properties
  - Form state management with Preact signals
  - API client for config and estimate endpoints
affects: [02-embeddable-widget, 03-lead-delivery]

# Tech tracking
tech-stack:
  added: [preact@10, @preact/signals@1, vite@6, @preact/preset-vite@2, terser@5]
  patterns: [shadow-dom-isolation, css-inline-import, iife-bundle, preact-signals-state]

key-files:
  created:
    - packages/widget/package.json
    - packages/widget/vite.config.ts
    - packages/widget/src/index.ts
    - packages/widget/src/App.tsx
    - packages/widget/src/components/RoofDetails.tsx
    - packages/widget/src/components/ContactInfo.tsx
    - packages/widget/src/components/EstimateDisplay.tsx
    - packages/widget/src/state/form.ts
    - packages/widget/src/api/client.ts
    - packages/widget/src/styles/widget.css
  modified:
    - packages/widget/vitest.config.ts

key-decisions:
  - "Used terser for minification (not included by default in Vite 6, added as devDependency)"
  - "Enabled css:true in vitest config to support ?inline CSS imports in tests"
  - "RoofDetails reads formData.value inside handleNext closure to avoid stale signal reads"

patterns-established:
  - "Shadow DOM init: create host div, attachShadow, inject style+root, render Preact app"
  - "CSS custom properties for branding: --rc-primary set via inline style on .rc-widget"
  - "Preact signals for cross-component state: currentStep, formData, estimateResult"
  - "No form elements: use div+button with onClick to avoid host page form submission issues"

requirements-completed: [WIDG-01, WIDG-02, WIDG-03, WIDG-04, WIDG-05]

# Metrics
duration: 4min
completed: 2026-03-09
---

# Phase 2 Plan 1: Widget Package Scaffold Summary

**Preact widget with Shadow DOM isolation, company branding, and 3-step form flow built as single 25KB IIFE bundle**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-09T23:42:24Z
- **Completed:** 2026-03-09T23:46:23Z
- **Tasks:** 2
- **Files modified:** 16

## Accomplishments
- Widget package scaffolded with Preact, Vite IIFE build, and Preact signals state management
- Shadow DOM entry point creates isolated widget from script tag with data-company-id
- Company branding (logo + primary color) fetched from API and applied via CSS custom properties
- Multi-step navigation: roof details (with validation) -> contact placeholder -> estimate display
- Full responsive CSS with all:initial reset, 44px tap targets, 320px-compatible layout
- 5 tests pass covering Shadow DOM init, branding, and step navigation
- Production build: 25.4KB unminified, 9.4KB gzipped single IIFE file

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold widget package with build and test infrastructure** - `954676b` (feat)
2. **Task 2 RED: Failing tests for Shadow DOM, branding, steps** - `94985e3` (test)
3. **Task 2 GREEN: Shadow DOM entry, App shell, step components** - `190ac15` (feat)

## Files Created/Modified
- `packages/widget/package.json` - Widget package with preact, signals, vite dependencies
- `packages/widget/vite.config.ts` - IIFE build config with terser minification
- `packages/widget/vitest.config.ts` - Test config with jsdom environment and css:true
- `packages/widget/tsconfig.json` - TypeScript config with Preact JSX
- `packages/widget/index.html` - Dev harness for local testing
- `packages/widget/src/index.ts` - Entry point: reads data-company-id, creates Shadow DOM, renders App
- `packages/widget/src/App.tsx` - Root component with config fetch, branding, step routing
- `packages/widget/src/components/RoofDetails.tsx` - Step 1: sqft, pitch, material inputs with validation
- `packages/widget/src/components/ContactInfo.tsx` - Step 2: placeholder for Plan 02
- `packages/widget/src/components/EstimateDisplay.tsx` - Step 3: estimate range display with currency formatting
- `packages/widget/src/state/form.ts` - Preact signals for form data, step index, estimate result
- `packages/widget/src/api/client.ts` - API client deriving base URL from script src
- `packages/widget/src/styles/widget.css` - Responsive styles with CSS custom properties for branding
- `packages/widget/src/vite-env.d.ts` - Type declarations for CSS inline imports
- `packages/widget/test/init.test.ts` - Tests for Shadow DOM creation and missing company-id
- `packages/widget/test/app.test.ts` - Tests for branding rendering and step navigation

## Decisions Made
- Added terser as explicit devDependency (Vite 6 no longer bundles it)
- Enabled `css: true` in vitest config so `?inline` CSS imports produce actual content in tests
- RoofDetails reads `formData.value` inside handleNext handler (not at render time) to avoid stale closure reads

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed missing terser dependency**
- **Found during:** Task 1 (build verification)
- **Issue:** Vite 6 requires terser as optional dependency for `minify: 'terser'`
- **Fix:** Added terser@^5 to devDependencies
- **Files modified:** packages/widget/package.json
- **Verification:** Build completes successfully
- **Committed in:** 954676b (Task 1 commit)

**2. [Rule 1 - Bug] Fixed stale signal read in RoofDetails validation**
- **Found during:** Task 2 (step navigation test)
- **Issue:** handleNext captured `data` from render-time closure, missing updates from updateField
- **Fix:** Read `formData.value` directly inside handleNext
- **Files modified:** packages/widget/src/components/RoofDetails.tsx
- **Verification:** Step navigation test passes
- **Committed in:** 190ac15 (Task 2 GREEN commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered
None beyond the auto-fixed deviations above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Widget package fully scaffolded with working build pipeline
- Plan 02 can add real contact form fields, TCPA consent, and API lead capture wiring
- API client and form state already support all fields needed for lead submission

## Self-Check: PASSED

All 12 key files verified present. All 3 task commits verified in git log.

---
*Phase: 02-embeddable-widget*
*Completed: 2026-03-09*
