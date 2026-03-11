# Phase 6: Polygon Drawing + sqft Auto-fill + UX - Research

**Researched:** 2026-03-11
**Domain:** Terra Draw (CDN/UMD), Google Maps Geometry Library, geodetic area math, pitch multipliers, CSP detection, Shadow DOM UX controls
**Confidence:** HIGH

## Summary

Phase 6 builds directly on the Phase 5 map infrastructure to add polygon drawing, real-time area calculation, pitch-adjusted sqft auto-fill, and graceful CSP fallback. The work has three technical cores: (1) loading Terra Draw via CDN UMD bundles alongside Google Maps, (2) initializing `TerraDrawGoogleMapsAdapter` with the map instance and wiring the `change`/`finish` events to extract polygon coordinates for live sqft display, and (3) calculating geodetic footprint area from `[lng, lat]` GeoJSON coordinates using `google.maps.geometry.spherical.computeArea()` then applying the pitch multiplier from the existing pricing engine.

The **pitch multiplier discrepancy** flagged in STATE.md is now resolved by direct inspection of `packages/api/src/engine/defaults.ts`: the authoritative values are `flat: 1.00`, `low: 1.05`, `medium: 1.12`, `steep: 1.25`. These same values must be used in the widget's `utils/area.ts` for pitch adjustment. Do not invent new values.

The **Terra Draw CDN loading** pattern is confirmed: two separate UMD script injections are required (`terra-draw.umd.js` and `terra-draw-google-maps-adapter.umd.js`), creating globals `window.terraDraw` and `window.terraDrawGoogleMapsAdapter`. The Google Maps adapter has a mandatory `ready` event — `draw.setMode('polygon')` must not be called until `draw.on('ready', ...)` fires. There is also a requirement that the map element has an `id` attribute set for the adapter to work.

The **CSP fallback** is handled by detecting fetch errors on `fetchMapsKey()` or `loadMapsApi()` failures — a new `mapError` signal drives the UI to show the manual-only mode with a silent error state (no broken UI, no visible error message to the homeowner).

**Primary recommendation:** Load Terra Draw UMD scripts via the same singleton CDN injection pattern used for Google Maps in Phase 5. Initialize `TerraDraw` with `TerraDrawGoogleMapsAdapter` inside `map.addListener("projection_changed", ...)` and start drawing only after `draw.on('ready', ...)` fires. Use `draw.on('change', ...)` to get live vertex updates and `draw.on('finish', ...)` to trigger auto-fill.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MEAS-01 | User can draw polygon vertices around roof outline on satellite map | `TerraDrawPolygonMode` with `TerraDrawGoogleMapsAdapter`; `draw.on('change')` fires on every vertex placement |
| MEAS-02 | Widget calculates footprint area from polygon and adjusts for selected pitch | `spherical.computeArea()` returns m², convert to ft², multiply by pitch multiplier from `defaults.ts` |
| MEAS-03 | Calculated sqft auto-fills the existing sqft field | On `draw.on('finish')` with `context.action === 'draw'`: extract coords → compute area → `updateField('sqft', rounded)` |
| MEAS-04 | User can tap "Done Drawing" to close polygon (mobile-friendly) | Terra Draw's polygon mode closes polygon on double-click/tap of first vertex; supplement with explicit "Done Drawing" button that calls `draw.stop()` then extracts the in-progress polygon from `draw.getSnapshot()` |
| MEAS-05 | User can undo last point or clear and restart the polygon | Terra Draw has no built-in undo-last-point API for polygon mode; use `draw.removeFeatures([id])` for Clear; for Undo, track vertex count and use `draw.getSnapshot()` + `addFeatures` pattern, OR use `TerraDrawSelectMode` with coordinate deletion |
| UX-01 | User can toggle between "Enter manually" (default) and "Measure on map" modes | `mapMode` signal already exists from Phase 5; extend App.tsx `mapMode === true` branch to show drawing controls after address selection |
| UX-02 | Widget gracefully degrades to manual entry if Maps API is blocked by host site CSP | Catch errors in `fetchMapsKey()` + `loadMapsApi()` → set `mapError` signal → App.tsx hides map toggle entirely when `mapError === true` |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| terra-draw | 1.25.0 (latest) | Polygon drawing state machine | Locked decision (STATE.md); replaces deprecated DrawingManager |
| terra-draw-google-maps-adapter | 1.3.1 (latest) | Bridges Terra Draw to Google Maps | Required companion; separate package for each map provider |
| google.maps.geometry.spherical | weekly channel | Geodetic area computation | Official Google Maps library; handles spherical Earth correctly; already loaded via bootstrap |
| @preact/signals | ^1 (installed) | Live sqft counter reactive state | Already used; zero new dependency |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| preact/hooks useRef | built-in | Hold Terra Draw instance across renders | Must persist draw instance without re-initializing |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `spherical.computeArea()` | Shoelace formula (custom) | Custom Shoelace ignores Earth's spherical surface — errors of ~0.3% at residential scale (~5 sq ft on 1500 sq ft roof). `spherical.computeArea()` is already available from Maps API (no extra load). Use the library. |
| `spherical.computeArea()` | Turf.js `area()` | Turf is 68KB gzipped; Maps geometry library is already loaded. Don't add Turf. |
| Terra Draw CDN UMD | Terra Draw npm import | npm import would be bundled — violates `inlineDynamicImports: true` constraint. CDN only. |

**Installation:** No new npm packages. Both terra-draw packages load via CDN script injection at draw activation.

---

## Architecture Patterns

### Recommended Project Structure
```
packages/widget/src/
├── maps/
│   ├── loader.ts           # existing — adds loadTerraDrawScripts() function
│   ├── autocomplete.ts     # existing — unchanged
│   ├── draw.ts             # new: TerraDraw instance lifecycle, initDraw(), destroyDraw()
│   └── types.ts            # existing — add DrawState type
├── utils/
│   └── area.ts             # new: computeFootprintSqft(coords, pitch) → number
├── components/
│   ├── MapStep.tsx         # existing — add drawing controls, live sqft counter
│   └── DrawingControls.tsx # new: "Done Drawing", "Undo", "Clear" buttons
├── state/
│   ├── map.ts              # existing — add drawingSqft, mapError signals
│   └── form.ts             # existing — unchanged (updateField('sqft') already works)
└── styles/widget.css       # existing — add drawing control styles
```

### Pattern 1: Terra Draw CDN UMD Loading (Two-Script Injection)
**What:** Inject `terra-draw.umd.js` then `terra-draw-google-maps-adapter.umd.js` sequentially into `document.head`. The adapter UMD depends on the core UMD being present as `window.terraDraw` first.
**When to use:** Called once when the homeowner activates drawing mode. Both scripts are required; order matters.

```typescript
// Source: https://unpkg.com/terra-draw@1.25.0/dist/terra-draw.umd.js (global: window.terraDraw)
// Source: https://unpkg.com/terra-draw-google-maps-adapter@1.3.1/dist/terra-draw-google-maps-adapter.umd.js
//         (global: window.terraDrawGoogleMapsAdapter)
// packages/widget/src/maps/loader.ts — add to existing file

let terraDrawLoaderPromise: Promise<void> | null = null;

export function loadTerraDrawScripts(): Promise<void> {
  if (terraDrawLoaderPromise) return terraDrawLoaderPromise;

  terraDrawLoaderPromise = new Promise<void>((resolve, reject) => {
    // Guard: already loaded
    if ((window as any).terraDraw?.TerraDraw && (window as any).terraDrawGoogleMapsAdapter?.TerraDrawGoogleMapsAdapter) {
      resolve();
      return;
    }

    // Must load core first, then adapter (adapter depends on window.terraDraw)
    const coreScript = document.createElement('script');
    coreScript.src = 'https://unpkg.com/terra-draw@1.25.0/dist/terra-draw.umd.js';
    coreScript.onload = () => {
      const adapterScript = document.createElement('script');
      adapterScript.src = 'https://unpkg.com/terra-draw-google-maps-adapter@1.3.1/dist/terra-draw-google-maps-adapter.umd.js';
      adapterScript.onload = () => resolve();
      adapterScript.onerror = () => reject(new Error('Terra Draw adapter failed to load'));
      document.head.appendChild(adapterScript);
    };
    coreScript.onerror = () => reject(new Error('Terra Draw core failed to load'));
    document.head.appendChild(coreScript);
  });

  return terraDrawLoaderPromise;
}

// Reset for testing
export function _resetTerraDrawLoaderForTesting(): void {
  terraDrawLoaderPromise = null;
}
```

**Key difference from Google Maps loader:** Terra Draw scripts load via `src=` (not `textContent`), so `onload` DOES fire. Do NOT call `resolve()` immediately after `appendChild` — wait for `onload`.

### Pattern 2: Terra Draw Initialization with Google Maps Adapter
**What:** Initialize Terra Draw after Google Maps map is ready. The adapter creates an `OverlayView` asynchronously — `draw.setMode()` must wait for the `'ready'` event.
**When to use:** After `map` instance exists and `projection_changed` fires (indicating map is fully initialized). MapView already has the map in `useRef`.

```typescript
// Source: https://github.com/JamesLMilner/terra-draw/blob/main/guides/3.ADAPTERS.md#google-maps
// packages/widget/src/maps/draw.ts

import type { SelectedPlace } from './types';

let drawInstance: any = null;

export function initDraw(map: any): Promise<any> {
  return new Promise((resolve) => {
    const { TerraDraw, TerraDrawPolygonMode } = (window as any).terraDraw;
    const { TerraDrawGoogleMapsAdapter } = (window as any).terraDrawGoogleMapsAdapter;

    const draw = new TerraDraw({
      adapter: new TerraDrawGoogleMapsAdapter({
        lib: (window as any).google.maps,
        map,
        coordinatePrecision: 9,
      }),
      modes: [new TerraDrawPolygonMode()],
    });

    draw.start();

    // CRITICAL: Must wait for 'ready' before calling setMode
    // The adapter creates an OverlayView which is only ready asynchronously
    draw.on('ready', () => {
      drawInstance = draw;
      resolve(draw);
    });
  });
}

export function getDrawInstance(): any {
  return drawInstance;
}

export function destroyDraw(): void {
  if (drawInstance) {
    drawInstance.stop();
    drawInstance = null;
  }
}

export function _resetDrawForTesting(): void {
  drawInstance = null;
}
```

**CRITICAL - Map element must have an id attribute**: The `TerraDrawGoogleMapsAdapter` requires the map container `div` to have an `id` attribute. MapView.tsx currently renders `<div ref={mapRef} class="rc-map-container" style={{ width: '100%', height: '300px' }} />`. Add `id="rc-map"` to the div.

### Pattern 3: Live sqft from Terra Draw `change` Event
**What:** Listen to `draw.on('change')` to extract polygon coordinates on every vertex placement. Compute area in real time. Update `drawingSqft` signal.
**When to use:** From the moment drawing starts until `Done Drawing` or polygon `finish`.

```typescript
// Source: https://github.com/JamesLMilner/terra-draw/blob/main/guides/6.EVENTS.md
// Source: https://developers.google.com/maps/documentation/javascript/reference/geometry#spherical.computeArea
// packages/widget/src/maps/draw.ts (continued)

export function startListeningForArea(
  draw: any,
  pitch: string,
  onAreaUpdate: (sqft: number) => void
): void {
  draw.on('change', (ids: string[], type: string) => {
    if (type === 'delete') return;

    const snapshot = draw.getSnapshot();
    // Find the polygon feature being drawn (skip coordinate point features)
    const polygon = snapshot.find(
      (f: any) => f.geometry.type === 'Polygon' && f.properties.mode === 'polygon'
    );
    if (!polygon) return;

    const coords = polygon.geometry.coordinates[0]; // outer ring: [[lng, lat], ...]
    if (coords.length < 3) return; // need at least a triangle

    const sqft = computeFootprintSqft(coords, pitch);
    onAreaUpdate(sqft);
  });

  draw.on('finish', (id: string, context: { action: string; mode: string }) => {
    if (context.action !== 'draw') return;
    const snapshot = draw.getSnapshot();
    const polygon = snapshot.find((f: any) => f.id === id);
    if (!polygon) return;

    const coords = polygon.geometry.coordinates[0];
    const sqft = computeFootprintSqft(coords, pitch);
    onAreaUpdate(sqft);
  });
}
```

### Pattern 4: Geodetic Area Calculation
**What:** Convert GeoJSON `[lng, lat]` coordinate array to square feet with pitch adjustment.
**When to use:** Called on every `change` and `finish` event for live updates.

```typescript
// Source: https://developers.google.com/maps/documentation/javascript/reference/geometry#spherical.computeArea
// packages/widget/src/utils/area.ts

// Authoritative pitch multipliers from packages/api/src/engine/defaults.ts
// VERIFIED: flat=1.00, low=1.05, medium=1.12, steep=1.25
const PITCH_MULTIPLIERS: Record<string, number> = {
  flat: 1.00,
  low: 1.05,
  medium: 1.12,
  steep: 1.25,
};

const SQ_METERS_TO_SQ_FEET = 10.7639;

/**
 * Compute pitch-adjusted roof area in square feet from a GeoJSON polygon ring.
 * @param coords - GeoJSON outer ring: [[lng, lat], ...] (NOT [lat, lng])
 * @param pitch - one of: 'flat' | 'low' | 'medium' | 'steep'
 * @returns pitch-adjusted square footage, rounded to nearest integer
 */
export function computeFootprintSqft(coords: number[][], pitch: string): number {
  // google.maps.geometry.spherical.computeArea accepts { lat, lng } objects or LatLng instances
  // GeoJSON is [lng, lat] — must swap
  const latLngPath = coords.map(([lng, lat]) => ({ lat, lng }));

  const { spherical } = (window as any).google.maps.geometry;
  const areaM2 = Math.abs(spherical.computeArea(latLngPath));

  const areaFt2 = areaM2 * SQ_METERS_TO_SQ_FEET;
  const pitchMult = PITCH_MULTIPLIERS[pitch] ?? 1.00;

  return Math.round(areaFt2 * pitchMult);
}
```

**CRITICAL — Coordinate order**: GeoJSON uses `[lng, lat]` but Google Maps `LatLngLiteral` uses `{ lat, lng }`. Swapping coordinates is required. Forgetting this produces a valid-looking result with wrong lat/lng values.

**Geometry library loading**: `spherical` is part of the `geometry` library, which is NOT loaded automatically by the bootstrap loader. It is available via `google.maps.importLibrary('geometry')` — but it must be loaded before `computeFootprintSqft` is called. Load it during Terra Draw initialization:

```typescript
// In initDraw() or MapStep useEffect, before starting drawing:
await (window as any).google.maps.importLibrary('geometry');
// Now window.google.maps.geometry.spherical is available
```

### Pattern 5: "Done Drawing" Button Implementation
**What:** Terra Draw's polygon mode closes naturally when the user clicks the first vertex again (within `pointerDistance` pixels). The "Done Drawing" button provides an explicit close for mobile users who struggle to tap the first vertex.
**When to use:** Displayed whenever drawing is active (after first vertex placed).

```typescript
// Terra Draw polygon mode: the in-progress polygon while drawing is a feature
// with properties.currentlyDrawing === true
// To close it programmatically, extract current coords and re-add as a complete polygon:

function handleDoneDrawing(draw: any): number[][] | null {
  const snapshot = draw.getSnapshot();
  const inProgress = snapshot.find(
    (f: any) => f.geometry.type === 'Polygon' &&
                f.properties.mode === 'polygon' &&
                f.properties.currentlyDrawing === true
  );

  if (!inProgress) return null;

  // Close the polygon: Terra Draw polygon ring ends with a duplicate of the first point
  // when finished. The in-progress ring's last point is the "ghost" cursor position.
  // Use all coords except the last (ghost) and close the ring.
  const ring = inProgress.geometry.coordinates[0];
  // ring has: [v1, v2, ..., vN, ghostPoint]
  // Closed polygon needs: [v1, v2, ..., vN, v1]
  const vertices = ring.slice(0, -1); // remove ghost point
  if (vertices.length < 3) return null;

  // Remove in-progress feature and add closed polygon
  draw.removeFeatures([inProgress.id]);

  const closedRing = [...vertices, vertices[0]];
  draw.addFeatures([{
    type: 'Feature',
    geometry: { type: 'Polygon', coordinates: [closedRing] },
    properties: { mode: 'polygon' },
  }]);

  return closedRing;
}
```

**Alternative simpler approach**: Use `draw.setMode('static')` which stops drawing and commits whatever is in-progress. Then read from `draw.getSnapshot()`. Test which approach Terra Draw 1.25.0 supports cleanly.

### Pattern 6: Clear Polygon
**What:** Remove all polygon features and restart drawing.

```typescript
function handleClearPolygon(draw: any): void {
  const snapshot = draw.getSnapshot();
  const polygonIds = snapshot
    .filter((f: any) => f.geometry.type === 'Polygon' || f.properties.mode === 'polygon')
    .map((f: any) => f.id);

  if (polygonIds.length > 0) {
    draw.removeFeatures(polygonIds);
  }
  draw.setMode('polygon'); // restart
}
```

### Pattern 7: CSP Fallback Detection
**What:** Detect when Google Maps API (or Terra Draw CDN) is blocked by the host page's CSP, and silently degrade to manual entry mode.
**When to use:** Wrap all map initialization in try/catch; on any error, set `mapError.value = true`.

```typescript
// Source: browser behavior — CSP blocks appear as network errors (not CSP violations in JS)
// packages/widget/src/components/MapStep.tsx (modified)

// In the useEffect that loads Maps:
try {
  const key = await fetchMapsKey();
  apiKey.value = key;
  await loadMapsApi(key);
} catch (err) {
  // Maps API blocked by CSP, Worker unavailable, or network error
  // Set error flag — App.tsx hides the map toggle entirely
  mapError.value = true;
  mapLoading.value = false;
  return;
}
```

```typescript
// packages/widget/src/state/map.ts — add new signal
export const mapError = signal(false);
```

```typescript
// packages/widget/src/App.tsx — hide map toggle on error
// Replace the "Measure on map" link with nothing when mapError is true
{!mapError.value && (
  <a class="rc-map-toggle" onClick={() => { mapMode.value = true; }}>
    Measure on map
  </a>
)}
```

### Pattern 8: Mode Toggle Flow in App.tsx Step 0
**What:** The existing App.tsx step 0 already toggles between `mapMode` and manual. Phase 6 extends the `mapMode === true` branch to show drawing controls after an address is selected.

Current flow (Phase 5):
```
Step 0:
  [mapMode=false] → RoofDetails (sqft input + pitch + material)  ← default
  [mapMode=true]  → MapStep (address search → satellite map)
```

Phase 6 extension:
```
Step 0:
  [mapMode=false] → RoofDetails (unchanged)
  [mapMode=true]  → MapStep:
    → AddressAutocomplete (search)
    → MapView (satellite map) [after address selected]
    → DrawingControls (Start Drawing / Done Drawing / Undo / Clear) [after map shows]
    → Live sqft counter [while drawing]
    → "Use this measurement" button [after polygon closed] → auto-fills sqft → mapMode=false
  "Enter sqft manually" link → mapMode=false (always visible in mapMode=true)
```

### Anti-Patterns to Avoid
- **Calling `draw.setMode()` before `draw.on('ready')`**: The Google Maps adapter creates an `OverlayView` asynchronously. Calling `setMode` before `ready` fires will silently fail.
- **Using GeoJSON `[lng, lat]` directly with `spherical.computeArea()`**: Google Maps expects `{ lat, lng }` or `[lat, lng]`. GeoJSON is `[lng, lat]`. Always swap.
- **Loading the `geometry` library with the bootstrap**: The bootstrap loader defers library loading. Must call `importLibrary('geometry')` explicitly before using `spherical.computeArea()`.
- **Loading Terra Draw UMD scripts in parallel**: The adapter UMD depends on `window.terraDraw` being present. Load core first (wait for `onload`), then adapter.
- **Missing `id` attribute on map container div**: `TerraDrawGoogleMapsAdapter` requires the map container to have an `id`. MapView.tsx must be updated to add `id="rc-map"`.
- **Trying to undo with Terra Draw select mode mid-draw**: `TerraDrawSelectMode` only works on committed (finished) features. Undo during drawing requires managing the polygon's coordinate array manually.

---

## Pitch Multiplier Resolution (STATE.md Blocker Resolved)

**Discrepancy resolved.** The authoritative source is `packages/api/src/engine/defaults.ts` (verified by direct file read):

```typescript
// packages/api/src/engine/defaults.ts — AUTHORITATIVE VALUES
export const DEFAULT_PITCH_MULTIPLIERS = {
  flat:   1.00,
  low:    1.05,
  medium: 1.12,
  steep:  1.25,
};
```

These are the **footprint-to-actual-roof-surface** multipliers that compensate for roof slope. When a homeowner traces the footprint on a satellite map, the polygon measures the horizontal projection. Multiplying by these values converts footprint area to actual roofable surface area.

**What `utils/area.ts` MUST use**: exactly these four values. Do not use any values from ARCHITECTURE.md or FEATURES.md if they differ — the API engine is the single source of truth for pricing consistency.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Geodetic area from lat/lng | Planar Shoelace formula | `google.maps.geometry.spherical.computeArea()` | Already available from Maps API (no extra load); handles spherical Earth correctly; ~0.3% error on residential scale is acceptable for custom |
| Polygon drawing state machine | Custom click handler + polyline overlay | `TerraDrawPolygonMode` | Handles vertex snapping, in-progress ghost line, double-click close, touch events, undo state |
| Coordinate precision | Custom rounding | Terra Draw's `coordinatePrecision: 9` setting | Prevents floating point noise in coordinates |
| Script load sequencing | Custom queue | Nested `onload` callbacks (core → adapter) | Terra Draw's adapter UMD requires `window.terraDraw` to exist synchronously |

**Key insight:** `spherical.computeArea()` is the correct tool because it handles spherical geometry using parallel transport — more accurate than planar triangulation methods for this use case.

---

## Common Pitfalls

### Pitfall 1: Terra Draw `ready` Event Required Before `setMode`
**What goes wrong:** Drawing never starts; Terra Draw silently ignores `setMode('polygon')` calls.
**Why it happens:** `TerraDrawGoogleMapsAdapter` creates a Google Maps `OverlayView` which is only ready after the map's `projection_changed` event. The adapter fires its `ready` event via `OverlayView.onAdd()`.
**How to avoid:** Always wait: `draw.on('ready', () => draw.setMode('polygon'))`.
**Warning signs:** No polygon vertices appear when clicking on the map; no JS errors.

### Pitfall 2: Missing `id` on Map Container
**What goes wrong:** `TerraDrawGoogleMapsAdapter` initialization fails or drawing overlays appear in the wrong position.
**Why it happens:** The adapter reads the map div's `id` to locate the container element for overlay positioning.
**How to avoid:** Add `id="rc-map"` to the `<div>` in `MapView.tsx`.
**Warning signs:** JS error about element not found; overlay mis-positioned.

### Pitfall 3: GeoJSON Coordinate Order `[lng, lat]` vs Google Maps `{ lat, lng }`
**What goes wrong:** `computeArea()` returns a value ~50x off or throws an error because coordinates are in wrong order.
**Why it happens:** GeoJSON spec uses `[longitude, latitude]`; Google Maps LatLngLiteral uses `{ lat, lng }`. Terra Draw returns GeoJSON format.
**How to avoid:** In `computeFootprintSqft`, always map `([lng, lat]) => ({ lat, lng })`.
**Warning signs:** Area calculation returns impossibly small or large numbers.

### Pitfall 4: `geometry` Library Not Loaded
**What goes wrong:** `TypeError: Cannot read properties of undefined (reading 'computeArea')` at runtime.
**Why it happens:** The Google Maps bootstrap loader sets up `importLibrary()` but doesn't pre-load `geometry`. It must be explicitly loaded before use.
**How to avoid:** Call `await google.maps.importLibrary('geometry')` before calling `computeFootprintSqft`. Do this in the Terra Draw initialization step, not lazily.
**Warning signs:** Runtime TypeError when drawing starts.

### Pitfall 5: Terra Draw UMD Core vs Adapter Load Order
**What goes wrong:** `TypeError: e is not a constructor` or similar error when creating `TerraDrawGoogleMapsAdapter` because `window.terraDraw` wasn't available when the adapter UMD evaluated.
**Why it happens:** The adapter UMD calls `t.TerraDrawExtend.TerraDrawBaseAdapter` (seen in source) where `t` is `window.terraDraw`. If core isn't loaded yet, `t` is undefined.
**How to avoid:** Load core script, wait for its `onload`, THEN inject adapter script.
**Warning signs:** Adapter constructor fails immediately.

### Pitfall 6: Terra Draw `getSnapshot()` Includes Point Features for Coordinate Display
**What goes wrong:** Iterating `getSnapshot()` finds unexpected `Point` features alongside the `Polygon`.
**Why it happens:** When `showCoordinatePoints: true` is enabled (or in some modes by default), Terra Draw adds point features to the store for each vertex.
**How to avoid:** Filter by `f.geometry.type === 'Polygon'` AND `f.properties.mode === 'polygon'` AND `!f.properties.currentlyDrawing` (for finished polygons).
**Warning signs:** Area calculation uses a Point feature's empty coordinates.

### Pitfall 7: `mapMode` Toggle Destroys Terra Draw Instance
**What goes wrong:** When the homeowner switches back to manual mode and then back to map mode, Terra Draw tries to re-initialize on an existing map instance, creating duplicate overlays.
**Why it happens:** MapView component unmounts/remounts when `mapMode` changes.
**How to avoid:** Call `destroyDraw()` in MapView/MapStep cleanup (`useEffect` return function). The `draw.stop()` method cleans up the OverlayView and event listeners.
**Warning signs:** Duplicate polygon overlays; ghost click events.

---

## Code Examples

### Complete Terra Draw + Google Maps Initialization Sequence

```typescript
// Source: https://github.com/JamesLMilner/terra-draw/blob/main/guides/3.ADAPTERS.md#google-maps
// Full initialization flow for MapStep.tsx

async function activateDrawing(mapInstance: any): Promise<void> {
  // 1. Load geometry library (required for computeArea)
  await (window as any).google.maps.importLibrary('geometry');

  // 2. Load Terra Draw UMD scripts (sequential, not parallel)
  await loadTerraDrawScripts();

  // 3. Initialize Terra Draw — must wait for Google Maps projection_changed
  // (MapView already handles projection_changed via map.addListener)
  // Here we initialize directly after map is ready:
  const draw = await initDraw(mapInstance);

  // 4. Wire change listener for live sqft updates
  draw.on('change', (ids: string[], type: string) => {
    if (type === 'delete') return;
    const snapshot = draw.getSnapshot();
    const polygon = snapshot.find(
      (f: any) => f.geometry.type === 'Polygon' &&
                  f.properties.mode === 'polygon'
    );
    if (!polygon || polygon.geometry.coordinates[0].length < 4) return;
    // coordinates[0] includes closing duplicate, so < 4 means fewer than 3 unique vertices
    const sqft = computeFootprintSqft(polygon.geometry.coordinates[0], formData.value.pitch);
    drawingSqft.value = sqft;
  });

  // 5. Wire finish listener for auto-fill
  draw.on('finish', (id: string, context: { action: string; mode: string }) => {
    if (context.action !== 'draw') return;
    if (drawingSqft.value > 0) {
      updateField('sqft', String(drawingSqft.value));
      // Optionally: mapMode.value = false to return to manual view with filled sqft
    }
  });
}
```

### `utils/area.ts` — Authoritative Implementation

```typescript
// Source: packages/api/src/engine/defaults.ts (pitch values)
// Source: https://developers.google.com/maps/documentation/javascript/reference/geometry#spherical.computeArea

const PITCH_MULTIPLIERS: Record<string, number> = {
  flat:   1.00,
  low:    1.05,
  medium: 1.12,
  steep:  1.25,
};

const SQ_METERS_TO_SQ_FEET = 10.7639104167;

export function computeFootprintSqft(coords: number[][], pitch: string): number {
  if (coords.length < 3) return 0;

  // GeoJSON: [lng, lat] → Google Maps needs { lat, lng }
  const path = coords.map(([lng, lat]) => ({ lat, lng }));

  const spherical = (window as any).google.maps.geometry.spherical;
  const areaM2 = Math.abs(spherical.computeArea(path));
  const areaFt2 = areaM2 * SQ_METERS_TO_SQ_FEET;
  const pitchMult = PITCH_MULTIPLIERS[pitch] ?? 1.00;

  return Math.round(areaFt2 * pitchMult);
}
```

### DrawingControls Component Skeleton

```tsx
// packages/widget/src/components/DrawingControls.tsx
// Controls rendered inside Shadow DOM — no portal needed (these are UI buttons, not floating dropdowns)

import { h } from 'preact';
import { drawingSqft } from '../state/map';

interface Props {
  isDrawing: boolean;
  hasPolygon: boolean;
  pitchLabel: string;
  onDoneDrawing: () => void;
  onClear: () => void;
  onUseArea: () => void;
}

export function DrawingControls({ isDrawing, hasPolygon, pitchLabel, onDoneDrawing, onClear, onUseArea }: Props) {
  return (
    <div class="rc-drawing-controls">
      {isDrawing && drawingSqft.value > 0 && (
        <div class="rc-sqft-live">
          ~{drawingSqft.value.toLocaleString()} sq ft ({pitchLabel} pitch)
        </div>
      )}
      {isDrawing && (
        <button class="rc-btn-secondary" onClick={onDoneDrawing}>
          Done Drawing
        </button>
      )}
      {hasPolygon && (
        <button class="rc-btn-primary" onClick={onUseArea}>
          Use This Measurement
        </button>
      )}
      {(isDrawing || hasPolygon) && (
        <button class="rc-btn-tertiary" onClick={onClear}>
          Clear &amp; Redraw
        </button>
      )}
    </div>
  );
}
```

### State Additions to `map.ts`

```typescript
// packages/widget/src/state/map.ts — add these signals to existing file
export const drawingSqft = signal(0);       // live sqft counter during drawing
export const mapError = signal(false);       // true when Maps API blocked by CSP or network error
export const isDrawingActive = signal(false); // true while Terra Draw polygon mode is active
export const hasFinishedPolygon = signal(false); // true after polygon closed/Done Drawing
```

---

## Terra Draw CDN URLs (Verified via unpkg.com)

| Package | Version | CDN URL | Global Variable |
|---------|---------|---------|-----------------|
| terra-draw core | 1.25.0 (latest as of 2026-03-11) | `https://unpkg.com/terra-draw@1.25.0/dist/terra-draw.umd.js` | `window.terraDraw` |
| terra-draw Google Maps adapter | 1.3.1 (latest as of 2026-03-11) | `https://unpkg.com/terra-draw-google-maps-adapter@1.3.1/dist/terra-draw-google-maps-adapter.umd.js` | `window.terraDrawGoogleMapsAdapter` |

**Version pinning recommendation**: Pin to specific versions (not `@latest`) to avoid unexpected breaks. Use `1.25.0` and `1.3.1`. Review terra-draw release notes before upgrading to a new minor.

**File size**: `terra-draw.umd.js` is ~196KB (raw), `terra-draw-google-maps-adapter.umd.js` is ~10KB. Both load lazily only when drawing mode is activated — widget bundle size is unaffected.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `google.maps.drawing.DrawingManager` | `TerraDrawPolygonMode` + `TerraDrawGoogleMapsAdapter` | Deprecated Aug 2025, removed May 2026 | DrawingManager is gone; Terra Draw is the only viable option |
| Planar Shoelace formula | `spherical.computeArea()` | Not a date change — was always better practice | Spherical geometry is more accurate for larger polygons |
| Single monolithic terra-draw npm package | Separate `terra-draw` + `terra-draw-google-maps-adapter` packages | terra-draw v1.0.0+ | Smaller bundle per adapter; must install both |

**Deprecated/outdated:**
- `google.maps.drawing.DrawingManager`: removed from Maps JS API May 2026 — do not use
- `terra-draw-google-maps-adapter` older than v1.0.0: pre-stable API, different initialization

---

## Open Questions

1. **"Done Drawing" via `draw.setMode()` or manual coordinate management?**
   - What we know: Terra Draw 1.25.0 docs show `draw.setMode('static')` puts Terra Draw in a non-drawing state. But whether this commits an in-progress polygon is unclear from docs.
   - What's unclear: Whether `setMode('static')` or `setMode('select')` on an in-progress polygon closes it or discards it.
   - Recommendation: Implement "Done Drawing" by extracting the in-progress polygon's coordinates from `getSnapshot()` (where `properties.currentlyDrawing === true`), removing it via `removeFeatures()`, and re-adding it as a closed polygon via `addFeatures()`. This is the most reliable approach.

2. **Undo last vertex: is there a Terra Draw built-in?**
   - What we know: Terra Draw docs describe `TerraDrawSelectMode` with `coordinates.deletable: true` for finished features. No built-in "undo last vertex during drawing" is mentioned in the docs.
   - What's unclear: Whether `draw.undoHistory()` or similar method exists in v1.25.0 (not visible in guides).
   - Recommendation: For v1.1, implement Clear (remove all) as the undo equivalent. True undo-last-vertex can be deferred to v2 (MEAS-05 requirement allows "undo last point or clear"). Implement Clear now; note undo-last-point as a follow-up.

3. **MapView.tsx `id` attribute: will adding `id="rc-map"` break anything?**
   - What we know: Phase 5 built MapView without an `id`. Adding `id="rc-map"` shouldn't break existing behavior (Phase 5 doesn't use the id).
   - Recommendation: Add `id="rc-map"`. It's a no-risk change with a required payoff for Terra Draw.

4. **Should "Use This Measurement" return to manual mode or advance to next step?**
   - What we know: The success criteria say the field should "auto-fill the sqft field." The form's sqft field is in RoofDetails (step 0, manual mode). The homeowner still needs to confirm pitch and material.
   - Recommendation: After "Use This Measurement": set `updateField('sqft', String(sqft))`, set `mapMode.value = false` (returns to RoofDetails with sqft pre-filled), let homeowner confirm pitch/material and click Next normally. This preserves the 4-step constraint and keeps pitch/material selection in one place.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~2.1 |
| Config file | `packages/widget/vitest.config.ts` |
| Quick run command | `cd packages/widget && npx vitest run` |
| Full suite command | `cd packages/widget && npx vitest run && cd ../api && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEAS-01 | `initDraw()` calls `draw.start()` then waits for `ready` before `setMode` | unit | `cd packages/widget && npx vitest run test/draw.test.ts` | ❌ Wave 0 |
| MEAS-01 | `draw.on('change')` fires and snapshot is read for polygon feature | unit | `cd packages/widget && npx vitest run test/draw.test.ts` | ❌ Wave 0 |
| MEAS-02 | `computeFootprintSqft([[lng,lat], ...], 'medium')` returns correct sqft | unit | `cd packages/widget && npx vitest run test/area.test.ts` | ❌ Wave 0 |
| MEAS-02 | Pitch multipliers match `defaults.ts`: flat=1.00, low=1.05, medium=1.12, steep=1.25 | unit | `cd packages/widget && npx vitest run test/area.test.ts` | ❌ Wave 0 |
| MEAS-02 | `computeFootprintSqft` returns 0 for < 3 coords | unit | `cd packages/widget && npx vitest run test/area.test.ts` | ❌ Wave 0 |
| MEAS-02 | Coordinate swap: `[lng, lat]` GeoJSON → `{ lat, lng }` Google Maps format | unit | `cd packages/widget && npx vitest run test/area.test.ts` | ❌ Wave 0 |
| MEAS-03 | `updateField('sqft', ...)` called with computed sqft on `finish` event | unit | `cd packages/widget && npx vitest run test/draw.test.ts` | ❌ Wave 0 |
| MEAS-04 | "Done Drawing" button calls polygon close logic | unit | `cd packages/widget && npx vitest run test/draw.test.ts` | ❌ Wave 0 |
| MEAS-05 | "Clear" removes all polygon features and restarts drawing mode | unit | `cd packages/widget && npx vitest run test/draw.test.ts` | ❌ Wave 0 |
| UX-01 | `mapMode=true` shows DrawingControls; `mapMode=false` shows RoofDetails | unit | `cd packages/widget && npx vitest run test/app.test.ts` | ✅ (existing, extend) |
| UX-01 | "Enter sqft manually" link sets `mapMode=false` | unit | `cd packages/widget && npx vitest run test/app.test.ts` | ✅ (existing, extend) |
| UX-02 | `mapError=true` hides "Measure on map" toggle entirely | unit | `cd packages/widget && npx vitest run test/app.test.ts` | ✅ (existing, extend) |
| UX-02 | Error in `fetchMapsKey()` sets `mapError.value = true` | unit | `cd packages/widget && npx vitest run test/app.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/widget && npx vitest run`
- **Per wave merge:** `cd packages/widget && npx vitest run && cd ../api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `packages/widget/test/area.test.ts` — covers MEAS-02 (mock `window.google.maps.geometry.spherical.computeArea`, test coordinate swap, pitch multipliers, edge cases)
- [ ] `packages/widget/test/draw.test.ts` — covers MEAS-01, MEAS-03, MEAS-04, MEAS-05 (mock `window.terraDraw` + `window.terraDrawGoogleMapsAdapter`, test Terra Draw lifecycle, event wiring, auto-fill)
- [ ] Extend `packages/widget/test/app.test.ts` — covers UX-01 (drawing controls visible), UX-02 (mapError hides toggle, error sets mapError)

---

## Sources

### Primary (HIGH confidence)
- [Terra Draw GitHub guides/3.ADAPTERS.md](https://github.com/JamesLMilner/terra-draw/blob/main/guides/3.ADAPTERS.md) — Google Maps adapter example, `ready` event requirement, `lib: google.maps` pattern
- [Terra Draw GitHub guides/4.MODES.md](https://github.com/JamesLMilner/terra-draw/blob/main/guides/4.MODES.md) — `TerraDrawPolygonMode`, `setMode`, `getSnapshot`, `currentlyDrawing` property
- [Terra Draw GitHub guides/6.EVENTS.md](https://github.com/JamesLMilner/terra-draw/blob/main/guides/6.EVENTS.md) — `change`, `finish`, `select`, `deselect` events; `context.action === 'draw'`
- [Terra Draw GitHub guides/1.GETTING_STARTED.md](https://github.com/JamesLMilner/terra-draw/blob/main/guides/1.GETTING_STARTED.md) — UMD CDN loading pattern, script tag usage
- [unpkg.com/terra-draw@1.25.0/dist/](https://unpkg.com/terra-draw/dist/) — Confirmed version 1.25.0 latest, UMD file name
- [unpkg.com/terra-draw-google-maps-adapter@1.3.1/dist/](https://unpkg.com/terra-draw-google-maps-adapter/dist/) — Confirmed version 1.3.1, UMD file name `terra-draw-google-maps-adapter.umd.js`
- [terra-draw-google-maps-adapter UMD source](https://unpkg.com/terra-draw-google-maps-adapter@1.3.1/dist/terra-draw-google-maps-adapter.umd.js) — Verified global name `terraDrawGoogleMapsAdapter`, confirmed `TerraDrawExtend.TerraDrawBaseAdapter` dependency on `window.terraDraw`
- [terra-draw UMD source first 500 bytes](https://unpkg.com/terra-draw@1.25.0/dist/terra-draw.umd.js) — Verified global name `terraDraw`
- [Google Maps Geometry Library Reference](https://developers.google.com/maps/documentation/javascript/reference/geometry#spherical.computeArea) — `spherical.computeArea(path)` signature, `LatLngLiteral` input, returns m², must load via `importLibrary('geometry')`
- `packages/api/src/engine/defaults.ts` (direct file read) — **Authoritative pitch multipliers**: flat=1.00, low=1.05, medium=1.12, steep=1.25

### Secondary (MEDIUM confidence)
- [Terra Draw getting started guide](https://jameslmilner.github.io/terra-draw/) — confirms monorepo structure, separate adapter packages
- `packages/widget/vite.config.ts` (direct file read) — confirmed `inlineDynamicImports: true` is still in place

### Tertiary (LOW confidence — flag for validation)
- Terra Draw "Done Drawing" via `setMode('static')` to commit in-progress polygon: not explicitly documented; needs empirical test
- Exact behavior of `properties.currentlyDrawing` on in-progress polygon: inferred from `4.MODES.md` mention of `currentlyDrawing` for styling; needs validation during implementation

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — CDN URLs verified via unpkg, UMD globals verified by reading bundle source, Terra Draw versions confirmed latest
- Terra Draw API (events, modes, adapters): HIGH — verified against official GitHub guides
- Area calculation: HIGH — `spherical.computeArea()` API verified from official Google Maps reference docs
- Pitch multipliers: HIGH — read directly from authoritative source file `defaults.ts`
- "Done Drawing" implementation: MEDIUM — the exact method to close an in-progress polygon needs empirical validation; two approaches documented
- Undo last vertex: LOW — no Terra Draw built-in found in docs; deferring to Clear in v1.1 is the safe path

**Research date:** 2026-03-11
**Valid until:** 2026-04-11 (Terra Draw releases infrequently; Google Maps `weekly` channel stable for these APIs)
