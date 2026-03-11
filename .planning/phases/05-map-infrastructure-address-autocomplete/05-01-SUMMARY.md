---
phase: 05-map-infrastructure-address-autocomplete
plan: 01
subsystem: api
tags: [google-maps, autocomplete, hono, cloudflare-workers, preact-signals, session-tokens]

# Dependency graph
requires: []
provides:
  - GET /api/maps/key endpoint returning GOOGLE_MAPS_API_KEY from Worker secret binding
  - Lazy CDN loader for Google Maps JS API (singleton promise, script injection)
  - AutocompleteSuggestion wrapper with session token lifecycle
  - PlacePredictionResult and SelectedPlace type definitions
  - Reactive signals for map mode state (mapMode, apiKey, selectedPlace, suggestions, mapLoading)
affects:
  - 05-02 (address autocomplete UI uses loader, autocomplete, and state signals)
  - 06 (map polygon drawing uses loader and state signals)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Singleton promise for lazy CDN script injection"
    - "Session token lifecycle: create on first keystroke, reuse across session, reset after fetchFields"
    - "Worker secret binding pattern for API key delivery (GET /api/maps-key)"

key-files:
  created:
    - packages/api/src/routes/maps.ts
    - packages/api/test/maps.test.ts
    - packages/widget/src/maps/loader.ts
    - packages/widget/src/maps/autocomplete.ts
    - packages/widget/src/maps/types.ts
    - packages/widget/src/state/map.ts
    - packages/widget/test/maps-loader.test.ts
    - packages/widget/test/autocomplete.test.ts
  modified:
    - packages/api/src/types.ts
    - packages/api/src/index.ts

key-decisions:
  - "No includedPrimaryTypes filter on AutocompleteSuggestion — broader results recommended by RESEARCH.md Open Question 2"
  - "Inline script resolve() called after appendChild (not onload) — inline textContent scripts execute synchronously"
  - "Session token reset only after resolvePlaceLocation completes fetchFields (ends billing session)"

patterns-established:
  - "TDD for all Maps infrastructure: RED (failing test) → GREEN (implementation) → committed atomically"
  - "Loader singleton: module-level loaderPromise prevents double CDN injection"
  - "_resetForTesting() and _resetSessionForTesting() exported for test isolation"

requirements-completed:
  - MAP-03
  - MAP-01

# Metrics
duration: 3min
completed: 2026-03-11
---

# Phase 5 Plan 01: Map Infrastructure + Address Autocomplete Summary

**GET /api/maps/key endpoint, lazy CDN loader singleton, and AutocompleteSuggestion session token wrapper with 10 new unit tests across API and widget packages**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-11T16:56:27Z
- **Completed:** 2026-03-11T16:59:20Z
- **Tasks:** 2
- **Files modified:** 10

## Accomplishments
- API endpoint delivering `GOOGLE_MAPS_API_KEY` from Cloudflare Worker secret binding — returns 200 with key or 503 when unset
- Lazy CDN loader with singleton promise pattern — injects Google Maps bootstrap script once, resolves immediately for inline scripts, guards against double injection when host page already loaded Maps
- AutocompleteSuggestion data layer — session token created on first keystroke, reused across session, reset after `fetchFields` ends billing session; returns empty array for inputs < 3 chars
- Type definitions (`PlacePredictionResult`, `SelectedPlace`) and reactive state signals (`mapMode`, `apiKey`, `selectedPlace`, `suggestions`, `mapLoading`) ready for UI consumption in Plan 02

## Task Commits

Each task was committed atomically:

1. **Task 1: API key endpoint + types + map state signals** - `de4bf02` (feat)
2. **Task 2: Lazy CDN loader + autocomplete data layer with tests** - `c89a110` (feat)

**Plan metadata:** _(commit hash recorded after metadata commit)_

## Files Created/Modified
- `packages/api/src/routes/maps.ts` - GET /key endpoint reading GOOGLE_MAPS_API_KEY from Worker env
- `packages/api/src/index.ts` - Mounts maps router at /api/maps
- `packages/api/src/types.ts` - Added GOOGLE_MAPS_API_KEY?: string to Bindings
- `packages/api/test/maps.test.ts` - 2 tests: 200 with key, 503 without key
- `packages/widget/src/maps/loader.ts` - Singleton CDN loader with _resetForTesting()
- `packages/widget/src/maps/autocomplete.ts` - Session token lifecycle wrapper with _resetSessionForTesting()
- `packages/widget/src/maps/types.ts` - PlacePredictionResult and SelectedPlace interfaces
- `packages/widget/src/state/map.ts` - mapMode, apiKey, selectedPlace, suggestions, mapLoading signals
- `packages/widget/test/maps-loader.test.ts` - 4 tests covering singleton, script injection, host page guard, importMapsLibrary delegation
- `packages/widget/test/autocomplete.test.ts` - 6 tests covering session token lifecycle, result shape, empty input guard

## Decisions Made
- **No `includedPrimaryTypes` filter**: Start without type filtering per RESEARCH.md recommendation (Open Question 2) — broader results, add filtering in Phase 6 if noise observed
- **Inline script resolve pattern**: `resolve()` called directly after `document.head.appendChild(script)` because `textContent` scripts execute synchronously (no `onload` event fires for inline content)
- **Session token reset timing**: Token nulled only after `fetchFields` completes (not before), ensuring the billing session ends correctly

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. The `GOOGLE_MAPS_API_KEY` secret needs to be set in Cloudflare Workers via `wrangler secret put GOOGLE_MAPS_API_KEY --cwd packages/api` before production use, but no setup is required for tests.

## Next Phase Readiness
- Plan 02 (address autocomplete UI) can now import `loadMapsApi`, `fetchSuggestions`, `resolvePlaceLocation` from the maps modules
- State signals (`mapMode`, `apiKey`, `selectedPlace`, `suggestions`) are ready for UI components
- All 6 new source files have corresponding test coverage (56 API tests + 19 widget tests all green)

---
*Phase: 05-map-infrastructure-address-autocomplete*
*Completed: 2026-03-11*

## Self-Check: PASSED

All key files exist on disk and task commits verified in git log.
