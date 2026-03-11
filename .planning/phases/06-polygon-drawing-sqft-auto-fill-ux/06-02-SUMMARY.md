---
phase: 06-polygon-drawing-sqft-auto-fill-ux
plan: 02
subsystem: ui
tags: [terra-draw, google-maps, polygon-drawing, preact, signals, vitest, tdd, drawing-controls, csp-fallback]

# Dependency graph
requires:
  - phase: 06-polygon-drawing-sqft-auto-fill-ux
    provides: computeFootprintSqft, Terra Draw lifecycle (draw.ts), loadTerraDrawScripts, drawingSqft/mapError/isDrawingActive/hasFinishedPolygon signals
provides:
  - DrawingControls component with Start/Done/Use This Measurement/Clear buttons and live sqft counter
  - MapStep extended with Terra Draw initialization, drawing flow, try/catch mapError handling, destroyDraw() cleanup
  - MapView with id="rc-map" (required by TerraDrawGoogleMapsAdapter) and onMapReady prop
  - App.tsx: mapError-aware mode toggle hides Measure on map link when CSP blocks API
  - widget.css: .rc-drawing-controls, .rc-sqft-live, .rc-btn-tertiary styles
  - 4 new tests covering UX-01 (mode toggle) and UX-02 (mapError hides toggle, error sets mapError)
affects: [phase 07 if any, integration testing, homeowner polygon-to-sqft flow end-to-end]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN: failing tests committed before implementation (RED=a59250b, GREEN=b67d8dc)"
    - "mapError signal gates map toggle — CSP-blocked Maps API silently degrades to manual mode"
    - "useEffect cleanup calls destroyDraw() — prevents duplicate Terra Draw overlays on mapMode toggle"
    - "activateDrawing async flow: importMapsLibrary('geometry') → loadTerraDrawScripts() → initDraw() → draw.setMode('polygon')"
    - "DrawingControls reads isDrawingActive/hasFinishedPolygon/drawingSqft directly from signals (Preact signals auto-subscribe)"

key-files:
  created:
    - packages/widget/src/components/DrawingControls.tsx
  modified:
    - packages/widget/src/components/MapStep.tsx
    - packages/widget/src/components/MapView.tsx
    - packages/widget/src/App.tsx
    - packages/widget/src/styles/widget.css
    - packages/widget/test/app.test.ts

key-decisions:
  - "DrawingControls reads signals directly (not via props) — Preact signals auto-subscribe components on .value access"
  - "activateDrawing() is async inside MapStep (not moved to draw.ts) — keeps UI state transitions co-located with signal writes"
  - "Enter sqft manually resets all drawing state: isDrawingActive, hasFinishedPolygon, drawingSqft, destroyDraw() — prevents stale draw instance on re-entry"
  - "mapError guard wraps only the Measure on map link — map step title and Enter sqft manually remain visible while in map mode"

patterns-established:
  - "CSP fallback: try/catch around fetchMapsKey + loadMapsApi → set mapError.value=true → UI hides toggle"
  - "Drawing flow: activateDrawing → draw.setMode('polygon') → startListeningForArea → handleDoneDrawing or handleClearPolygon → handleUseArea"

requirements-completed: [UX-01, UX-02]

# Metrics
duration: 28min
completed: 2026-03-11
---

# Phase 6 Plan 02: UI Layer — Drawing Controls, MapStep Flow, mapError Gate Summary

**DrawingControls component + MapStep Terra Draw activation flow + CSP-graceful mapError toggle gate — 35 widget tests + 56 API tests green**

## Performance

- **Duration:** 28 min
- **Started:** 2026-03-11T17:54:39Z
- **Completed:** 2026-03-11T18:23:07Z
- **Tasks:** 2 (Task 1 = DrawingControls + MapStep + MapView; Task 2 = TDD RED → GREEN for App.tsx + CSS + tests)
- **Files modified:** 6

## Accomplishments
- Created `DrawingControls.tsx` with 4-button state machine: Start Drawing (initial) → Done Drawing (while active) → Use This Measurement + Clear & Redraw (polygon complete) — with live sqft counter during drawing
- Extended `MapStep.tsx` with full Terra Draw activation flow: try/catch mapError handling, `activateDrawing()` async function, `useEffect` cleanup calling `destroyDraw()`
- Fixed `MapView.tsx`: added `id="rc-map"` (required by TerraDrawGoogleMapsAdapter) and `onMapReady` prop for map instance handoff
- Updated `App.tsx`: `mapError.value` gates the "Measure on map" link visibility (UX-02); "Enter sqft manually" now resets all drawing state; removed stale TODO Continue button
- Added 4 new tests in `app.test.ts` covering UX-01 (mode toggle visibility) and UX-02 (mapError hides toggle, fetchMapsKey rejection propagates to mapError)
- TDD RED-GREEN cycle: 1 test deliberately failed before App.tsx change, then passed after

## Task Commits

Each task was committed atomically:

1. **Task 1: DrawingControls + MapStep drawing flow + MapView id fix** - `3aa7f90` (feat)
2. **Task 2 RED: extend app.test.ts with UX-01 and UX-02 coverage** - `a59250b` (test)
3. **Task 2 GREEN: gate map toggle on mapError, add drawing control CSS** - `b67d8dc` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `packages/widget/src/components/DrawingControls.tsx` - Drawing UI: Start Drawing / Done Drawing / Use This Measurement / Clear & Redraw / live sqft counter
- `packages/widget/src/components/MapStep.tsx` - Extended orchestrator: Terra Draw initialization, drawing controls integration, mapError handling, destroyDraw() cleanup
- `packages/widget/src/components/MapView.tsx` - Added `id="rc-map"` (TerraDrawGoogleMapsAdapter requirement) and `onMapReady` prop
- `packages/widget/src/App.tsx` - mapError-aware mode toggle: hides "Measure on map" when mapError=true; Enter sqft manually resets drawing state
- `packages/widget/src/styles/widget.css` - Added .rc-drawing-controls, .rc-sqft-live, .rc-btn-tertiary styles
- `packages/widget/test/app.test.ts` - 4 new tests: UX-01 (mode toggle) + UX-02 (mapError gate + fetch error propagation)

## Decisions Made
- **DrawingControls reads signals directly** — Preact signals auto-subscribe on `.value` access, so no prop-drilling for `isDrawingActive`, `hasFinishedPolygon`, `drawingSqft`
- **activateDrawing() stays in MapStep** — keeps UI state transitions (isDrawingActive, mapError) co-located with the component that owns them
- **Enter sqft manually resets all drawing state** — prevents stale draw instance and dangling overlays if homeowner switches modes mid-draw

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None — all implementations matched the plan contracts exactly. The TDD cycle worked as expected: 1 test (UX-02 mapError gate) failed in RED phase, passed after App.tsx update.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Phase 6 complete: all 7 requirements (MEAS-01..05 from Plan 01, UX-01+UX-02 from Plan 02) have passing automated test coverage
- Full homeowner flow is wired: trace polygon → live sqft counter → "Use This Measurement" → sqft auto-fills in RoofDetails
- CSP fallback is silent: mapError=true hides the map toggle, homeowner proceeds with manual entry
- 35 widget tests + 56 API tests green
- No blockers for phase transition

## Self-Check: PASSED

All 7 key files present on disk. All 3 task commits verified in git log (3aa7f90, a59250b, b67d8dc).

---
*Phase: 06-polygon-drawing-sqft-auto-fill-ux*
*Completed: 2026-03-11*
