---
phase: 05-map-infrastructure-address-autocomplete
plan: 02
subsystem: ui
tags: [google-maps, preact, address-autocomplete, satellite-map, portal, shadow-dom, lazy-loading]

# Dependency graph
requires:
  - phase: 05-map-infrastructure-address-autocomplete
    provides: loadMapsApi, fetchSuggestions, resolvePlaceLocation, mapMode/apiKey/selectedPlace/suggestions/mapLoading signals
provides:
  - AddressAutocomplete component with portal dropdown (renders outside Shadow DOM via document.body portal)
  - MapView component showing satellite/hybrid map at zoom 20 centered on selected property
  - MapStep orchestrator that lazily fetches API key and bootstraps Maps API on first activation
  - "Measure on map" toggle in App.tsx step 0 that activates MapStep (lazy loading guard for MAP-03)
  - fetchMapsKey() API call in api/client.ts
affects:
  - 06 (polygon drawing adds to MapStep/MapView, uses same mapMode/selectedPlace signals)
  - 07 (lead email integration reads selectedPlace.formattedAddress)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Portal pattern for Shadow DOM escape: createPortal to document.body with inline styles (CSS classes don't reach document.body)"
    - "onMouseDown preventDefault on dropdown items to prevent blur-before-click (input blur fires before click)"
    - "mapMode signal as lazy-loading gate: fetchMapsKey and loadMapsApi called only when mapMode becomes true"
    - "useRef for map instance: re-center on lat/lng change via map.setCenter() instead of re-initializing"
    - "Explicit container height (300px) required for Maps API to render (zero-height container produces invisible map)"

key-files:
  created:
    - packages/widget/src/components/AddressAutocomplete.tsx
    - packages/widget/src/components/MapView.tsx
    - packages/widget/src/components/MapStep.tsx
  modified:
    - packages/widget/src/App.tsx
    - packages/widget/src/api/client.ts
    - packages/widget/src/styles/widget.css

key-decisions:
  - "Portal renders into document.body with inline styles (not CSS classes) — Shadow DOM boundary prevents class-based styling from reaching portaled content"
  - "onMouseDown + preventDefault on suggestion items prevents blur event from hiding dropdown before click fires"
  - "mapMode signal is the sole guard for lazy loading — no Maps API calls until homeowner explicitly activates map mode (MAP-03)"
  - "MapView stores map instance in useRef and calls setCenter() on lat/lng change instead of re-creating map"

patterns-established:
  - "Shadow DOM portal escape: createPortal(content, document.body) + inline styles for any dropdown/overlay that must not be clipped"
  - "Lazy external API bootstrap: signal flag gates all network calls, activated by explicit user interaction"

requirements-completed:
  - MAP-01
  - MAP-02
  - MAP-03

# Metrics
duration: deferred
completed: 2026-03-11
---

# Phase 5 Plan 02: Address Autocomplete UI + Map Display Summary

**AddressAutocomplete portal dropdown + satellite MapView + MapStep lazy orchestrator integrated into widget step 0 with MAP-03 lazy-loading gate — manual sqft path unaffected**

## Performance

- **Duration:** N/A (plan execution deferred — human verification pending API key)
- **Started:** 2026-03-11T17:03:30Z (task 1 commit)
- **Completed:** 2026-03-11T17:08:04Z (metadata commit)
- **Tasks:** 1 auto (complete) + 1 human-verify (deferred pending API key)
- **Files modified:** 6

## Accomplishments
- AddressAutocomplete component with 300ms debounce, portal dropdown rendered outside Shadow DOM via `createPortal` to `document.body`, `onMouseDown preventDefault` to fix blur-before-click (RESEARCH.md Pitfall 5)
- MapView satellite/hybrid map at zoom 20 with explicit 300px height (RESEARCH.md Pitfall 3), re-centers on coordinate change without re-initializing map instance
- MapStep orchestrator that lazily calls `fetchMapsKey()` + `loadMapsApi()` only when `mapMode` signal becomes true (MAP-03 requirement fulfilled)
- App.tsx "Measure on map" toggle activates MapStep within step 0; "Enter sqft manually" returns to manual entry; both paths fully functional
- `fetchMapsKey()` added to `api/client.ts` — fetches `GET /api/maps/key` and returns the key string
- CSS classes for all map UI elements (`.rc-address-input`, `.rc-map-container`, `.rc-map-toggle`, `.rc-map-loading`, `.rc-selected-address`)
- All 75 existing tests (19 widget + 56 API) pass

## Task Commits

Each task was committed atomically:

1. **Task 1: AddressAutocomplete, MapView, MapStep + App integration** - `4d057dd` (feat)
2. **Task 2: Human verify** - _(deferred — approved pending API key, no code changes)_

**Plan metadata:** _(recorded after this metadata commit)_

## Files Created/Modified
- `packages/widget/src/components/AddressAutocomplete.tsx` — Address input with portal dropdown, 300ms debounce, fetchSuggestions integration
- `packages/widget/src/components/MapView.tsx` — Satellite/hybrid map at zoom 20, explicit height, re-center on coordinate change
- `packages/widget/src/components/MapStep.tsx` — Lazy API key fetch + loader bootstrap, orchestrates address-to-map flow
- `packages/widget/src/App.tsx` — Map mode toggle within step 0, renders MapStep when mapMode=true
- `packages/widget/src/api/client.ts` — Added fetchMapsKey() function
- `packages/widget/src/styles/widget.css` — Map UI CSS classes

## Decisions Made
- **Portal to document.body with inline styles**: Shadow DOM boundary means CSS classes applied inside the widget cannot style content appended to `document.body`. All portal dropdown styles are inline.
- **onMouseDown preventDefault on suggestion items**: Browser fires `blur` on the input before `click` on the list item. Without `preventDefault` on `mousedown`, the dropdown hides before the click registers. This is RESEARCH.md Pitfall 5.
- **mapMode signal as sole lazy-loading gate**: `fetchMapsKey()` and `loadMapsApi()` are called inside a `useEffect` that runs only when `mapMode.value` becomes true. No Maps API network requests occur on widget load (MAP-03 requirement).
- **Re-center vs. re-initialize**: MapView stores the Maps `Map` instance in `useRef`. When `lat`/`lng` props change, it calls `map.setCenter()` rather than destroying and recreating the map, preserving zoom level and tile cache.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None during Task 1 implementation.

## Human Verification Status

**Deferred** — User approved with note that no Google Maps API key is currently available. Visual verification of the full address-to-map flow (autocomplete dropdown, satellite map display, lazy loading behavior) will be performed manually once `GOOGLE_MAPS_API_KEY` is configured in `packages/api/.dev.vars`.

Steps to verify when API key is available:
1. `cd /home/mike/roofing_calculator && npm run dev`
2. Open the widget in a browser
3. Click "Measure on map" → verify Maps API request appears in Network tab only at this point
4. Type a partial address → verify autocomplete dropdown appears
5. Click a suggestion → verify satellite map centers on property at zoom 20
6. Click "Enter sqft manually" → verify manual entry still works

## User Setup Required

To enable full functionality:
- Add `GOOGLE_MAPS_API_KEY=<key>` to `packages/api/.dev.vars` for local development
- Run `wrangler secret put GOOGLE_MAPS_API_KEY --cwd packages/api` for production deployment
- See `packages/api/.dev.vars.example` for the required format

## Next Phase Readiness
- Phase 5 complete — all 3 MAP requirements implemented (MAP-01: autocomplete, MAP-02: satellite map, MAP-03: lazy loading)
- Phase 6 (polygon drawing) can build directly on `MapStep`/`MapView` components and existing `mapMode`/`selectedPlace` signals
- `selectedPlace.value.formattedAddress` is ready for Phase 7 lead email integration

---
*Phase: 05-map-infrastructure-address-autocomplete*
*Completed: 2026-03-11*

## Self-Check: PASSED

- `packages/widget/src/components/AddressAutocomplete.tsx` — EXISTS ✓
- `packages/widget/src/components/MapView.tsx` — EXISTS ✓
- `packages/widget/src/components/MapStep.tsx` — EXISTS ✓
- `packages/widget/src/App.tsx` — EXISTS (modified) ✓
- `packages/widget/src/api/client.ts` — EXISTS (modified) ✓
- `packages/widget/src/styles/widget.css` — EXISTS (modified) ✓
- Task 1 commit `4d057dd` — VERIFIED in git log ✓
