---
phase: 06-polygon-drawing-sqft-auto-fill-ux
plan: 01
subsystem: maps
tags: [terra-draw, google-maps, area-calculation, polygon-drawing, signals, vitest, tdd]

# Dependency graph
requires:
  - phase: 05-map-infrastructure-address-autocomplete
    provides: loader.ts singleton pattern, map.ts signals pattern, form.ts updateField
provides:
  - computeFootprintSqft(coords, pitch) in packages/widget/src/utils/area.ts
  - Terra Draw lifecycle module (initDraw, destroyDraw, startListeningForArea, handleDoneDrawing, handleClearPolygon) in packages/widget/src/maps/draw.ts
  - loadTerraDrawScripts() singleton in packages/widget/src/maps/loader.ts
  - drawingSqft, mapError, isDrawingActive, hasFinishedPolygon signals in packages/widget/src/state/map.ts
affects: [06-02-PLAN, MapStep component, DrawingControls component, App.tsx CSP fallback]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD RED-GREEN cycle: test stubs created before implementation files"
    - "Terra Draw CDN UMD loading: sequential onload chain (core → adapter) via src= script injection"
    - "Coordinate swap: GeoJSON [lng,lat] → Google Maps {lat,lng} before spherical.computeArea"
    - "Signal extension pattern: add signals to bottom of existing map.ts (not new file)"

key-files:
  created:
    - packages/widget/src/utils/area.ts
    - packages/widget/src/maps/draw.ts
    - packages/widget/test/area.test.ts
    - packages/widget/test/draw.test.ts
  modified:
    - packages/widget/src/maps/loader.ts
    - packages/widget/src/state/map.ts

key-decisions:
  - "PITCH_MULTIPLIERS in area.ts match packages/api/src/engine/defaults.ts exactly: flat=1.00, low=1.05, medium=1.12, steep=1.25"
  - "loadTerraDrawScripts uses sequential onload chain (NOT parallel) — adapter UMD depends on window.terraDraw existing synchronously"
  - "initDraw resolves promise only after 'ready' event — TerraDrawGoogleMapsAdapter OverlayView is asynchronous"
  - "drawingSqft signal updated in startListeningForArea 'change' handler AND returned via onAreaUpdate callback (dual path)"

patterns-established:
  - "Terra Draw lifecycle: initDraw → startListeningForArea → handleDoneDrawing/handleClearPolygon → destroyDraw"
  - "Area calculation: coords[0].length < 3 guard → swap [lng,lat] to {lat,lng} → spherical.computeArea → × SQ_FT → × pitchMult → round"

requirements-completed: [MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05]

# Metrics
duration: 4min
completed: 2026-03-11
---

# Phase 6 Plan 01: Core Computation Layer Summary

**TDD-first: computeFootprintSqft (pitch-adjusted geodetic area), Terra Draw lifecycle (initDraw/destroyDraw/event wiring), sequential CDN loader, and 4 drawing state signals — 31 widget tests green**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-11T17:46:10Z
- **Completed:** 2026-03-11T17:50:28Z
- **Tasks:** 2 (Task 1 = RED stubs, Task 2 = GREEN implementations)
- **Files modified:** 6

## Accomplishments
- Created `area.ts` with `computeFootprintSqft` — swaps GeoJSON `[lng,lat]` coords to `{lat,lng}`, calls `spherical.computeArea`, applies pitch multiplier, rounds to integer
- Created `draw.ts` with full Terra Draw lifecycle: `initDraw` (start + wait for 'ready'), `startListeningForArea` (change/finish event wiring), `handleDoneDrawing` (closes in-progress polygon), `handleClearPolygon`, `destroyDraw`
- Extended `loader.ts` with `loadTerraDrawScripts()` — sequential `onload` chain loads core UMD first, then adapter UMD
- Extended `state/map.ts` with 4 drawing signals: `drawingSqft`, `mapError`, `isDrawingActive`, `hasFinishedPolygon`
- TDD cycle complete: RED stubs committed first, then GREEN implementations; 12 new tests added, 0 regressions to 19 existing tests

## Task Commits

Each task was committed atomically:

1. **Task 1: Write failing test stubs [RED]** - `53c1235` (test)
2. **Task 2a: Implement area.ts [GREEN]** - `5e345a3` (feat)
3. **Task 2b: Implement draw.ts [GREEN]** - `48ef362` (feat)
4. **Task 2c: Extend loader.ts + map.ts [GREEN]** - `1281d98` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified
- `packages/widget/src/utils/area.ts` - `computeFootprintSqft(coords, pitch)` — geodetic area with pitch adjustment
- `packages/widget/src/maps/draw.ts` - Terra Draw lifecycle module (initDraw, destroyDraw, startListeningForArea, handleDoneDrawing, handleClearPolygon, _resetDrawForTesting)
- `packages/widget/src/maps/loader.ts` - Added `loadTerraDrawScripts()` and `_resetTerraDrawLoaderForTesting()`
- `packages/widget/src/state/map.ts` - Added drawingSqft, mapError, isDrawingActive, hasFinishedPolygon signals
- `packages/widget/test/area.test.ts` - 4 tests covering MEAS-02 (pitch math, coord swap, edge cases)
- `packages/widget/test/draw.test.ts` - 8 tests covering MEAS-01, MEAS-03, MEAS-04, MEAS-05

## Decisions Made
- **Pitch multipliers from defaults.ts:** Used `flat=1.00, low=1.05, medium=1.12, steep=1.25` exactly matching the API engine's authoritative values
- **Sequential loader (not parallel):** The terra-draw-google-maps-adapter UMD reads `window.terraDraw.TerraDrawExtend.TerraDrawBaseAdapter` synchronously at evaluation time — parallel loading fails
- **Dual sqft update in change handler:** `drawingSqft.value = sqft` updates the signal directly AND `onAreaUpdate(sqft)` fires the callback; this allows the component to react without directly importing the signal

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected steep pitch test expectation from 1346 to 1345**
- **Found during:** Task 2 (area.ts implementation)
- **Issue:** Test expected `computeFootprintSqft(..., 'steep')` to return 1346, but `100m² × 10.7639104167 × 1.25 = 1345.489` which rounds to 1345
- **Fix:** Updated area.test.ts expected value from 1346 to 1345 (correct math)
- **Files modified:** packages/widget/test/area.test.ts
- **Verification:** `npx vitest run test/area.test.ts` — 4 tests pass
- **Committed in:** 5e345a3 (Task 2a commit)

---

**Total deviations:** 1 auto-fixed (1 bug in test expectation)
**Impact on plan:** Minor correction to test expected value; no scope creep, no implementation changes required.

## Issues Encountered
None — all implementations matched the research patterns exactly.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All 4 source modules exist with correct exports — Plan 02 (UI components: MapStep drawing controls, DrawingControls component, App.tsx CSP fallback) can import from these modules
- draw.ts and area.ts are the dependency targets for `<key_links>` in Plan 01 frontmatter
- `loadTerraDrawScripts()` ready to be called from MapStep before `initDraw()`
- No blockers

## Self-Check: PASSED

All key files present on disk. All 4 task commits verified in git log.

---
*Phase: 06-polygon-drawing-sqft-auto-fill-ux*
*Completed: 2026-03-11*
