---
phase: 06-polygon-drawing-sqft-auto-fill-ux
verified: 2026-03-11T18:27:00Z
status: human_needed
score: 20/20 must-haves verified (automated)
re_verification: false
human_verification:
  - test: "Polygon renders visibly on satellite map after clicking Start Drawing"
    expected: "A red/colored polygon overlay appears on the Google Maps satellite view as the user clicks vertices"
    why_human: "Requires a real Google Maps API key; cannot verify canvas/WebGL rendering programmatically"
  - test: "Live sqft counter updates in real time while drawing polygon vertices"
    expected: "The .rc-sqft-live div updates with the current pitch-adjusted sqft each time a new vertex is placed, with no visible lag"
    why_human: "Terra Draw change events fire against live map — requires API key and browser interaction"
  - test: "Terra Draw touch controls work on mobile (single-finger tap to place vertex)"
    expected: "On a mobile device, single-finger taps place polygon vertices; gestureHandling='greedy' allows panning with one finger on the map but not while in polygon-draw mode"
    why_human: "Touch event behavior requires a physical mobile device or emulator with a live map"
  - test: "Done Drawing closes the polygon cleanly (no ghost cursor vertex)"
    expected: "After tapping Done Drawing, the polygon closes to a clean shape without a stray vertex at the cursor position"
    why_human: "Requires live Terra Draw with a real map to verify the ghost-point removal (vertices = ring.slice(0, -1)) renders correctly"
  - test: "Use This Measurement auto-fills the sqft field and returns to RoofDetails"
    expected: "The sqft input in RoofDetails shows the computed value (e.g., '1,250'); mapMode=false restores the manual entry form"
    why_human: "End-to-end browser flow; the signal-to-form wiring is verified in code but the visual transition cannot be confirmed without running the widget"
  - test: "mapError=true silently hides 'Measure on map' link (no error message shown to user)"
    expected: "When Maps API is CSP-blocked, the homeowner sees only the manual entry form with no error indicator — the map option simply disappears"
    why_human: "Graceful-degradation UX quality requires visual inspection; the logic is verified but the user-perception cannot be automated"
---

# Phase 6: Polygon Drawing & Sqft Auto-Fill UX — Verification Report

**Phase Goal:** A homeowner can trace their roof outline on the satellite map, see the pitch-adjusted square footage calculated in real time, and have it auto-fill the sqft field — with a seamless fallback to manual entry throughout

**Verified:** 2026-03-11T18:27:00Z
**Status:** HUMAN_NEEDED — all automated checks PASS; 6 items require a Google Maps API key for browser-level verification
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `computeFootprintSqft([[lng,lat], ...], 'medium')` returns correct pitch-adjusted sqft | ✓ VERIFIED | `area.ts` lines 18–29; 4 passing tests in `area.test.ts` |
| 2 | Pitch multipliers match `defaults.ts`: flat=1.00, low=1.05, medium=1.12, steep=1.25 | ✓ VERIFIED | `area.ts` lines 3–8 exactly match `api/src/engine/defaults.ts` lines 10–13 |
| 3 | `computeFootprintSqft` returns 0 for fewer than 3 coordinates | ✓ VERIFIED | `area.ts` line 19: `if (coords.length < 3) return 0;`; test covers 0, 1, and 2 coords |
| 4 | GeoJSON `[lng,lat]` pairs swapped to `{lat,lng}` before `computeArea` | ✓ VERIFIED | `area.ts` line 22: `coords.map(([lng, lat]) => ({ lat, lng }))`; swap verified by test asserting `{ lat: 42.456, lng: -83.123 }` shape |
| 5 | `loadTerraDrawScripts()` loads core UMD first, then adapter UMD sequentially (onload chain) | ✓ VERIFIED | `loader.ts` lines 73–86: `coreScript.onload = () => { appendChild(adapterScript); adapterScript.onload = () => resolve(); }` — NOT parallel, NOT textContent |
| 6 | `initDraw()` calls `draw.start()` then waits for `'ready'` event before resolving | ✓ VERIFIED | `draw.ts` lines 26–33: `draw.start()` then `draw.on('ready', () => { resolve(draw); })`; 2 tests confirm start-before-ready and promise-waits-for-event |
| 7 | `draw.on('change')` fires live sqft update via `drawingSqft` signal | ✓ VERIFIED | `draw.ts` lines 60–75: change handler → `computeFootprintSqft` → `drawingSqft.value = sqft`; test confirms `onAreaUpdate` called with 1206 |
| 8 | `draw.on('finish')` with `action='draw'` triggers `updateField('sqft', ...)` | ✓ VERIFIED | `draw.ts` lines 77–88: finish handler checks `context.action !== 'draw'`; calls `updateField('sqft', String(sqft))`; test confirms `updateField` called with `'1206'` |
| 9 | `handleClearPolygon` removes all polygon features and restarts polygon mode | ✓ VERIFIED | `draw.ts` lines 133–144: filters snapshot by `Polygon` type OR `mode='polygon'`; calls `removeFeatures` then `draw.setMode('polygon')`; test confirms both calls |
| 10 | `DrawingControls` appear below map when `mapMode=true` and `selectedPlace` is set | ✓ VERIFIED | `MapStep.tsx` lines 125–140: `{selectedPlace.value && (<div>...<DrawingControls .../></div>)}`; UX-01 test confirms map step renders |
| 11 | Clicking 'Start Drawing' activates Terra Draw polygon mode (`isDrawingActive=true`) | ✓ VERIFIED | `MapStep.tsx` lines 57–85: `activateDrawing()` calls `initDraw` → `draw.setMode('polygon')` → `isDrawingActive.value = true` |
| 12 | While drawing, live sqft counter shows `drawingSqft.value` with pitch label | ✓ VERIFIED | `DrawingControls.tsx` lines 18–22: `{isDrawing && drawingSqft.value > 0 && <div class="rc-sqft-live">~{...} sq ft ({pitchLabel} pitch)</div>}` |
| 13 | Clicking 'Done Drawing' closes in-progress polygon and sets `hasFinishedPolygon=true` | ✓ VERIFIED | `MapStep.tsx` lines 87–96: `handleDoneDrawingClick()` calls `handleDoneDrawing`, sets `isDrawingActive.value=false`, `hasFinishedPolygon.value=true` |
| 14 | Clicking 'Use This Measurement' calls `updateField('sqft', ...)` and sets `mapMode=false` | ✓ VERIFIED | `MapStep.tsx` lines 98–107: `handleUseArea()` calls `updateField('sqft', String(drawingSqft.value))` and `mapMode.value = false` |
| 15 | Clicking 'Clear & Redraw' removes polygon and restarts drawing mode | ✓ VERIFIED | `MapStep.tsx` lines 109–114: `handleClear()` calls `handleClearPolygon`, resets `hasFinishedPolygon.value=false`, `isDrawingActive.value=true` |
| 16 | When `mapMode=false`, RoofDetails shown; 'Measure on map' link visible (UX-01) | ✓ VERIFIED | `App.tsx` lines 75–88: else branch renders `<RoofDetails/>`; `!mapError.value` guards the link; UX-01 test passes |
| 17 | When `mapError=true`, 'Measure on map' link is hidden entirely (UX-02) | ✓ VERIFIED | `App.tsx` line 78: `{!mapError.value && (<a class="rc-map-toggle">Measure on map</a>)}`; UX-02 test asserts link absent when `mapError.value=true` |
| 18 | `MapStep` wraps Maps API init in try/catch — on error sets `mapError.value=true` (UX-02) | ✓ VERIFIED | `MapStep.tsx` lines 29–37: try/catch around `fetchMapsKey` + `loadMapsApi`; `mapError.value = true` in catch; UX-02 fetch-rejection test passes |
| 19 | `MapView` div has `id='rc-map'` (required by TerraDrawGoogleMapsAdapter) | ✓ VERIFIED | `MapView.tsx` line 47: `id="rc-map"` on the container div |
| 20 | `destroyDraw()` called in `MapStep` useEffect cleanup (prevents duplicate overlays on re-mount) | ✓ VERIFIED | `MapStep.tsx` lines 44–46: `return () => { destroyDraw(); }` in useEffect cleanup |

**Score:** 20/20 truths verified (automated)

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `packages/widget/src/utils/area.ts` | ✓ VERIFIED | 30 lines; exports `computeFootprintSqft`; substantive implementation with coordinate swap, pitch multipliers, Math.round |
| `packages/widget/src/maps/draw.ts` | ✓ VERIFIED | 151 lines; exports `initDraw`, `destroyDraw`, `startListeningForArea`, `handleDoneDrawing`, `handleClearPolygon`, `_resetDrawForTesting`; wired to `area.ts` and `state/form` |
| `packages/widget/src/maps/loader.ts` | ✓ VERIFIED | Extended with `loadTerraDrawScripts()` (sequential onload chain) and `_resetTerraDrawLoaderForTesting()`; core singleton preserved |
| `packages/widget/src/state/map.ts` | ✓ VERIFIED | 14 lines; all 4 new signals present: `drawingSqft`, `mapError`, `isDrawingActive`, `hasFinishedPolygon` |
| `packages/widget/src/components/DrawingControls.tsx` | ✓ VERIFIED | 45 lines; 4-button state machine; live sqft counter; reads signals directly; wired to `MapStep` handlers |
| `packages/widget/src/components/MapStep.tsx` | ✓ VERIFIED | 144 lines; full Terra Draw activation flow; try/catch mapError; `activateDrawing()`; all handlers; `destroyDraw()` in cleanup |
| `packages/widget/src/components/MapView.tsx` | ✓ VERIFIED | 53 lines; `id="rc-map"` on div; `onMapReady` prop; calls `onMapReady(mapInstance)` after map creation |
| `packages/widget/src/App.tsx` | ✓ VERIFIED | `mapError` gate wraps "Measure on map" link; "Enter sqft manually" resets all drawing state; no stale TODO buttons |
| `packages/widget/src/styles/widget.css` | ✓ VERIFIED | `.rc-drawing-controls`, `.rc-sqft-live`, `.rc-btn-secondary` (in drawing context), `.rc-btn-tertiary` all present with correct styles |
| `packages/widget/test/area.test.ts` | ✓ VERIFIED | 4 tests; covers MEAS-02: pitch math, coord swap, < 3 coords guard, positive integer return |
| `packages/widget/test/draw.test.ts` | ✓ VERIFIED | 8 tests; covers MEAS-01 (initDraw), MEAS-03 (finish→updateField), MEAS-04 (handleDoneDrawing), MEAS-05 (handleClearPolygon); destroyDraw |
| `packages/widget/test/app.test.ts` | ✓ VERIFIED | 6 tests total (2 pre-existing + 4 new); UX-01 (mode toggle links) and UX-02 (mapError gate + fetch rejection) covered |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `draw.ts` | `utils/area.ts` | `computeFootprintSqft` call in `startListeningForArea` | ✓ WIRED | `draw.ts` line 1 import + lines 72, 85 calls |
| `draw.ts` | `state/form.ts` | `updateField('sqft', ...)` on finish event | ✓ WIRED | `draw.ts` line 2 import + line 87 call in finish handler |
| `draw.ts` | `state/map.ts` | `drawingSqft.value = sqft` on change event | ✓ WIRED | `draw.ts` line 3 import + line 73 assignment in change handler |
| `MapStep.tsx` | `maps/draw.ts` | `activateDrawing()` calls `initDraw` + `startListeningForArea` | ✓ WIRED | `MapStep.tsx` line 5 import + lines 69, 78 calls |
| `MapStep.tsx` | `state/map.ts` | reads/writes `isDrawingActive`, `hasFinishedPolygon`, `mapError`, `drawingSqft` | ✓ WIRED | Line 6 import; signal writes at lines 35, 74, 83, 90–91, 94, 103–106, 112–113 |
| `App.tsx` | `state/map.ts` | `mapError.value` gates 'Measure on map' link | ✓ WIRED | `App.tsx` line 5 import + line 78 guard `{!mapError.value && (...)}` |
| `MapStep.tsx` | `maps/loader.ts` | `loadTerraDrawScripts()` in `activateDrawing()` | ✓ WIRED | `MapStep.tsx` line 4 import + line 66 call |
| `MapView.tsx` | `MapStep.tsx` | `onMapReady` callback passes map instance | ✓ WIRED | `MapView.tsx` lines 36–37 calls `onMapReady(mapInstanceRef.current)`; `MapStep.tsx` line 53 sets `mapInstanceRef.current = map` |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MEAS-01 | 06-01-PLAN | User can draw polygon vertices around roof outline on satellite map | ✓ SATISFIED | `initDraw` → `draw.setMode('polygon')` in `activateDrawing()`; `draw.test.ts` 2 tests for initDraw lifecycle |
| MEAS-02 | 06-01-PLAN | Widget calculates footprint area from polygon and adjusts for selected pitch | ✓ SATISFIED | `computeFootprintSqft` with 4 pitch multipliers; `area.test.ts` 4 tests confirm math |
| MEAS-03 | 06-01-PLAN | Calculated sqft auto-fills the existing sqft field | ✓ SATISFIED | `startListeningForArea` finish handler calls `updateField('sqft', String(sqft))`; also `handleUseArea` calls `updateField`; test confirms |
| MEAS-04 | 06-01-PLAN | User can tap "Done Drawing" to close polygon (mobile-friendly) | ✓ SATISFIED | `handleDoneDrawing` removes ghost vertex and adds closed polygon; "Done Drawing" button rendered when `isDrawingActive=true`; `draw.test.ts` verifies ghost removal |
| MEAS-05 | 06-01-PLAN | User can undo last point or clear and restart the polygon | ✓ SATISFIED | `handleClearPolygon` removes all polygon features + `draw.setMode('polygon')` restarts; "Clear & Redraw" button visible when `isDrawing OR hasPolygon`; `draw.test.ts` verifies |
| UX-01 | 06-02-PLAN | User can toggle between "Enter manually" (default) and "Measure on map" modes | ✓ SATISFIED | `App.tsx` mapMode branch: RoofDetails with "Measure on map" link vs MapStep with "Enter sqft manually" link; `app.test.ts` UX-01 tests confirm both branches render correct links |
| UX-02 | 06-02-PLAN | Widget gracefully degrades to manual entry if Maps API is blocked by host site CSP | ✓ SATISFIED | `MapStep.tsx` try/catch sets `mapError.value=true`; `App.tsx` `{!mapError.value && (...)}` hides the toggle entirely; `app.test.ts` UX-02 tests confirm both the fetch-rejection path and DOM absence |

**All 7 requirements accounted for. No orphaned requirements detected.**

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|------------|
| `draw.ts` line 106 | `return null` | ℹ️ Info | Legitimate null return — guard for "no in-progress polygon found" in `handleDoneDrawing`; not a stub |
| `draw.ts` line 113 | `return null` | ℹ️ Info | Legitimate null return — guard for "< 3 vertices" edge case; not a stub |

**No blockers. No stubs. No TODO/FIXME/placeholder comments in any Phase 6 source file.**

---

### Test Suite Results

```
Widget package (packages/widget):
  ✓ test/area.test.ts      4 tests — MEAS-02 pitch math, coord swap, edge cases
  ✓ test/draw.test.ts      8 tests — MEAS-01/03/04/05: initDraw, startListening, handleDone, handleClear, destroyDraw
  ✓ test/app.test.ts       6 tests — branding, step advance, UX-01 (×2), UX-02 (×2)
  ✓ test/autocomplete.test.ts  6 tests — Phase 5 regression
  ✓ test/contact.test.ts   4 tests — Phase 5 regression
  ✓ test/maps-loader.test.ts   4 tests — loader singleton regression
  ✓ test/init.test.ts      3 tests — widget init regression
  TOTAL: 35/35 tests PASS

API package (packages/api):
  ✓ test/engine.test.ts    7 tests
  ✓ test/lead-notification.test.ts  6 tests
  ✓ test/maps.test.ts      2 tests
  ✓ test/estimates.test.ts 17 tests
  ✓ test/admin.test.ts     24 tests
  TOTAL: 56/56 tests PASS
```

**91/91 tests green across both packages. Zero regressions to Phase 5.**

---

### Commit Integrity

All 7 documented commits verified to exist in the repository:

| Commit | Type | Description |
|--------|------|-------------|
| `53c1235` | test | add failing test stubs for area.ts and draw.ts [RED] |
| `5e345a3` | feat | implement computeFootprintSqft area utility [GREEN] |
| `48ef362` | feat | implement Terra Draw lifecycle module (draw.ts) [GREEN] |
| `1281d98` | feat | extend loader with loadTerraDrawScripts and map state with drawing signals |
| `3aa7f90` | feat | add DrawingControls, extend MapStep with drawing flow, fix MapView id |
| `a59250b` | test | extend app.test.ts with UX-01 and UX-02 coverage [RED] |
| `b67d8dc` | feat | gate map toggle on mapError, add drawing control CSS [GREEN] |

TDD RED→GREEN cycle verified: test stubs committed before implementations.

---

### Human Verification Required

The following items **cannot be verified without a Google Maps API key**. Per the user's instruction, these are classified `human_needed` (not `gaps_found`).

#### 1. Polygon Renders Visibly on Satellite Map

**Test:** Load the widget with a valid Maps API key, enter an address, click "Measure on map", then click "Start Drawing". Click 4–5 points around a roof outline.
**Expected:** A colored polygon overlay renders on the satellite imagery; vertices are visible; edges connect correctly.
**Why human:** Requires live Maps API + Terra Draw OverlayView rendering in a real browser DOM.

#### 2. Live Sqft Counter Updates in Real Time

**Test:** While drawing (per test 1), observe the `.rc-sqft-live` counter after placing each vertex.
**Expected:** Counter updates immediately after each vertex placement (e.g., "~1,206 sq ft (medium pitch)"). No flicker or stale values.
**Why human:** Terra Draw `'change'` event fires against the live map canvas — cannot simulate with unit tests.

#### 3. Terra Draw Touch Controls on Mobile

**Test:** On a mobile browser (iOS Safari or Android Chrome), place vertices with single-finger taps; verify polygon draws correctly.
**Expected:** Single-finger taps place vertices. The map does not accidentally pan while placing vertices in polygon mode.
**Why human:** `gestureHandling: 'greedy'` and touch event behavior requires physical device or emulator.

#### 4. Done Drawing Closes Polygon Cleanly (No Ghost Vertex)

**Test:** After drawing 4+ vertices, click "Done Drawing". Inspect the rendered polygon shape.
**Expected:** Polygon closes to the first vertex with no stray point at the last cursor position (the ghost vertex is removed by `ring.slice(0, -1)`).
**Why human:** Requires live Terra Draw to verify `getSnapshot()` behavior and that the re-added closed polygon renders correctly.

#### 5. Use This Measurement Auto-Fills Sqft Field

**Test:** Complete a polygon (tests 1–4 above), then click "Use This Measurement".
**Expected:** Widget returns to RoofDetails step; the sqft input shows the computed value; user can proceed to contact step.
**Why human:** End-to-end signal-to-form wiring + visual transition cannot be confirmed without running the full widget.

#### 6. CSP-Blocked Maps API Degrades Silently

**Test:** Deploy widget to a host page with a CSP header that blocks `maps.googleapis.com`. Observe step 0.
**Expected:** Widget shows only RoofDetails with manual entry. "Measure on map" link is absent. No error message or broken UI.
**Why human:** CSP enforcement requires a real browser + server-side CSP headers; cannot simulate in jsdom.

---

### Gaps Summary

**No automated gaps detected.** All 20 observable truths verified, all 9 artifacts substantive and wired, all 8 key links confirmed, all 7 requirements satisfied, and 91/91 tests pass.

The only open items are the 6 **human verification** items above, all of which require a live Google Maps API key to test end-to-end browser behavior. These are expected deferred items per the project context (API key not yet configured).

---

_Verified: 2026-03-11T18:27:00Z_
_Verifier: Claude (gsd-verifier)_
