# Architecture Research

**Domain:** Google Maps roof measurement integration into existing Preact Shadow DOM widget
**Researched:** 2026-03-10
**Confidence:** HIGH (Google official docs verified, deprecation timeline confirmed from official source)

---

## Existing Architecture (What We're Integrating Into)

```
Host Website
  └── <script data-company-id="..."> (single IIFE, 28KB gzipped)
        └── Shadow DOM Host (#roofing-widget-host)
              ├── <style> (inlined widget.css, all: initial on :host)
              └── #roofing-widget-root
                    └── Preact App (signals-based state)
                          ├── Step 0: RoofDetails (sqft + pitch + material)
                          ├── Step 1: ContactInfo
                          └── Step 2: EstimateDisplay

State: @preact/signals (currentStep, formData, estimateResult, isLoading)
API:   Hono on Cloudflare Workers (D1/R2)
Build: Vite IIFE, inlineDynamicImports: true, minify: terser
```

Key constraint: `inlineDynamicImports: true` in the Vite config means everything is bundled
into a single synchronous IIFE. Google Maps JS API (~800KB+ uncompressed) must NOT be
bundled — it loads from Google's CDN at runtime via a dynamic `<script>` tag appended to
`document.head`.

---

## New Architecture: v1.1 Google Maps Integration

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│ Shadow DOM Widget (unchanged outer shell)                         │
│                                                                   │
│  Step 0: RoofDetails (orchestrator — modified)                    │
│  ├── Sub-step A: AddressInput (NEW)                               │
│  │     ├── <input class="rc-input"> — inside Shadow DOM           │
│  │     └── suggestions <ul> — portal in document.body            │
│  │           (outside Shadow DOM, position: fixed)                │
│  │                                                                │
│  ├── Sub-step B: RoofMap (NEW)                                    │
│  │     ├── <div class="rc-map-container"> — inside Shadow DOM     │
│  │     │     └── google.maps.Map instance (renders here)          │
│  │     └── Terra Draw (npm, bundled) — polygon mode               │
│  │           draw.on('change') → GeoJSON → area.ts → sqft         │
│  │                                                                │
│  └── Sub-step C: SquareFootageConfirm (NEW)                       │
│        ├── sqft input (pre-filled from map OR manual entry)       │
│        ├── pitch selector (reused)                                │
│        └── material selector (reused)                             │
│                                                                   │
│  Step 1: ContactInfo     (unchanged)                              │
│  Step 2: EstimateDisplay (unchanged)                              │
└──────────────────────────────────────────────────────────────────┘

document.head (outside Shadow DOM):
  └── <script src="maps.googleapis.com/...?key=KEY&loading=async">
        └── google.maps.importLibrary('maps')   → lazy, on map step
            google.maps.importLibrary('places') → lazy, on address step
```

### Component Responsibilities

| Component | Responsibility | Status |
|-----------|----------------|--------|
| `RoofDetails` | Orchestrates sub-steps A/B/C via internal step counter | Modify |
| `AddressInput` | Programmatic AutocompleteSuggestion, custom-styled input, portal dropdown | New |
| `RoofMap` | Lazy-loads Maps API, renders satellite Map, owns Terra Draw instance | New |
| `PolygonDrawing` | Draw/clear/confirm UI controls, converts GeoJSON polygon to sqft | New |
| `SquareFootageConfirm` | Displays calculated sqft (editable), pitch + material pickers | New |
| `state/form.ts` | Adds `mapAddress`, `mapCoords`, `mapFootprintSqft` signals | Modify |
| `api/client.ts` | No new network call needed (API key comes from existing config fetch) | Modify |
| `utils/area.ts` | Pure: GeoJSON polygon → sq meters → sqft, pitch multiplier lookup | New |

---

## Recommended Project Structure

```
packages/widget/src/
├── components/
│   ├── RoofDetails.tsx           # modified: sub-step orchestrator
│   ├── AddressInput.tsx          # new: programmatic autocomplete
│   ├── RoofMap.tsx               # new: map container + Maps API loader
│   ├── PolygonDrawing.tsx        # new: Terra Draw controls
│   ├── SquareFootageConfirm.tsx  # new: sqft confirm + selectors
│   ├── ContactInfo.tsx           # unchanged
│   └── EstimateDisplay.tsx       # unchanged
├── state/
│   └── form.ts                   # modified: add map signals
├── api/
│   └── client.ts                 # modified: config response includes googleMapsApiKey
├── utils/
│   └── area.ts                   # new: polygon area math (pure, unit-testable)
├── styles/
│   └── widget.css                # add .rc-map-container height + map control styles
└── index.ts                      # unchanged

packages/api/src/
├── routes/
│   └── config.ts                 # modified: return googleMapsApiKey
└── types.ts                      # modified: add GOOGLE_MAPS_API_KEY to Bindings
```

### Structure Rationale

- **`utils/area.ts`** is extracted as a pure function so it can be unit-tested before any Google Maps UI exists. This is the most bug-prone calculation in the feature.
- **`components/`** keeps each sub-step in its own file — the map step is significantly more complex than the existing steps and would overwhelm RoofDetails.tsx if inlined.
- **API key stays in existing config endpoint** — no new network round-trip, key is scoped to the existing company config fetch.

---

## Architectural Patterns

### Pattern 1: Runtime Bootstrap for Google Maps JS API

**What:** Append a `<script>` tag to `document.head` at runtime with the API key from the config response. Call `google.maps.importLibrary('places')` when the address input mounts. Call `google.maps.importLibrary('maps')` when the map step mounts.

**When to use:** Always. Never bundle the Maps JS API. The CDN copy is cached across all websites that use Google Maps and benefits from Google's global CDN. Bundling it would add ~800KB to the IIFE and violate the spirit of Google's usage model.

**Trade-offs:** Adds ~100-200ms latency when Maps first loads. Mitigated by starting the library bootstrap when AddressInput mounts (before the map is shown), so `importLibrary('maps')` resolves quickly by the time the user reaches RoofMap.

```typescript
// utils/mapsLoader.ts
let bootstrapPromise: Promise<void> | null = null;

export function bootstrapMapsApi(apiKey: string): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = new Promise((resolve, reject) => {
    const callbackName = '__rcMapsReady';
    (window as any)[callbackName] = resolve;
    const script = document.createElement('script');
    // loading=async: defers execution, does not block host page
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=${callbackName}`;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return bootstrapPromise;
}

export async function loadMapsLibrary(lib: 'maps' | 'places' | 'geometry') {
  await bootstrapPromise;
  return (window as any).google.maps.importLibrary(lib);
}
```

The `loading=async` flag is mandatory: without it, the bootstrap script blocks the main thread.

---

### Pattern 2: Programmatic Autocomplete (Not PlaceAutocompleteElement)

**What:** Use `google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions()` to retrieve predictions on each input keystroke. Render predictions in a custom `<ul>` portal in `document.body`. Use a standard `<input class="rc-input">` inside the Shadow DOM.

**Why not `PlaceAutocompleteElement` (`gmp-place-autocomplete`):**

`PlaceAutocompleteElement` is a Web Component with its own **closed Shadow DOM**. When placed inside our widget's Shadow DOM, two compounding problems arise:

1. Its internal `<input>` is behind a closed Shadow boundary — no CSS from our `widget.css` can reach it. The component looks completely unstyled.
2. The `.pac-container` suggestions dropdown appends to `document.body` with `position: absolute` using coordinates relative to the `PlaceAutocompleteElement`'s position. When that element is nested inside a Shadow DOM, the dropdown positions incorrectly (viewport coordinate mismatch).

Using the programmatic API gives full control over both the input element (identical to existing `rc-input` fields) and the dropdown placement.

**Note on API availability:** As of March 1, 2025, `google.maps.places.AutocompleteService` and `google.maps.places.Autocomplete` (the legacy widget) are not available to new customers. Use `AutocompleteSuggestion` instead.

```typescript
// AddressInput.tsx — abbreviated
export function AddressInput({ onSelect }: { onSelect: (coords: LatLng, address: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleInput(value: string) {
    if (value.length < 3) return;
    const { suggestions } = await google.maps.places.AutocompleteSuggestion
      .fetchAutocompleteSuggestions({ input: value });
    updateSuggestionsPortal(suggestions, inputRef.current!, onSelect);
  }

  return (
    <input
      ref={inputRef}
      class="rc-input"
      placeholder="Enter your home address"
      onInput={(e) => handleInput((e.target as HTMLInputElement).value)}
    />
  );
}
```

---

### Pattern 3: Suggestions Dropdown as document.body Portal

**What:** Render the autocomplete `<ul>` as a child of `document.body`, positioned with `position: fixed` based on `getBoundingClientRect()` of the Shadow DOM input.

**When to use:** Any floating UI element (dropdown, tooltip, popover) that originates inside a Shadow DOM but must overflow its container or appear above the host page's stacking context.

**Trade-offs:** Manual cleanup required on unmount. Must use `position: fixed` (not `absolute`) to handle host page scroll containers correctly. Z-index must be high enough to clear the host site.

```typescript
// Lifecycle: create portal on mount, remove on unmount
useEffect(() => {
  const portal = document.createElement('div');
  portal.id = 'rc-autocomplete-portal';
  portal.style.cssText = 'position:fixed;z-index:2147483647;background:#fff;border:1px solid #d1d5db;border-radius:6px;box-shadow:0 4px 6px rgba(0,0,0,.1);';
  document.body.appendChild(portal);
  return () => portal.remove();
}, []);

// On each fetch result: position portal relative to input
function positionPortal(inputEl: HTMLInputElement) {
  const r = inputEl.getBoundingClientRect();
  portal.style.top = `${r.bottom}px`;
  portal.style.left = `${r.left}px`;
  portal.style.width = `${r.width}px`;
}
```

---

### Pattern 4: Terra Draw for Polygon Drawing

**What:** Install `terra-draw` as an npm dependency (bundled into the IIFE). Initialize `TerraDrawGoogleMapsAdapter` after the `google.maps.Map` instance is created. Enable `TerraDrawPolygonMode`. Listen to `draw.on('change')` to get GeoJSON when the polygon is complete.

**Why Terra Draw over Google's DrawingManager:**

Google's DrawingManager was **deprecated August 2025** and will be **removed in May 2026**. Any new code written with DrawingManager will break at the next forced API version bump. Terra Draw is Google's own recommended replacement — the official Maps JS API documentation links to a Terra Draw example as the drawing reference.

**Why Terra Draw over DIY polygon clicks:**

Polygon drawing with vertex editing, touch support, double-click-to-close, and keyboard escape handling is non-trivial. Terra Draw provides all of this tested and maintained.

**Trade-offs:** Terra Draw adds ~50KB minified to the IIFE bundle. Since the current build uses `inlineDynamicImports: true`, it goes into the main bundle (loads with every widget instantiation). This is acceptable because:
- Terra Draw is pure logic that initializes lazily when the map step is reached
- The 50KB is the cost of the drawing feature; it only matters to users who reach the map step

```typescript
// PolygonDrawing.tsx — abbreviated
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter';

export function initDrawing(map: google.maps.Map) {
  const draw = new TerraDraw({
    adapter: new TerraDrawGoogleMapsAdapter({ map, lib: google.maps }),
    modes: [new TerraDrawPolygonMode()],
  });
  draw.start();
  draw.setMode('polygon');

  draw.on('change', (ids) => {
    const features = draw.getSnapshot();
    const polygon = features.find(f => f.geometry.type === 'Polygon' && ids.includes(f.id));
    if (polygon) {
      const sqft = polygonToSqft(polygon);
      mapFootprintSqft.value = sqft;
    }
  });
  return draw;
}
```

---

### Pattern 5: Polygon Area Calculation (Pure Function)

**What:** Convert a GeoJSON Polygon feature (WGS84 lat/lng coordinates) to square feet using Turf.js's area function (which implements the Shoelace formula on a spherical coordinate system), then multiply by the pitch adjustment factor.

**Why @turf/area over a hand-rolled Shoelace formula:**

The naive Shoelace formula assumes planar coordinates. Lat/lng coordinates are spherical. For a 2,000 sqft roof, the error from planar Shoelace on lat/lng is small but measurable (~0.1-0.3%). `@turf/area` correctly accounts for the spherical surface. Use the sub-package import, not the full `@turf/turf` bundle (~400KB).

```typescript
// utils/area.ts
import area from '@turf/area'; // ~8KB, sub-package import

const SQMETERS_TO_SQFT = 10.7639;

// Pitch multipliers: footprint sqft × multiplier = actual roof surface sqft
// Based on standard roofing industry slope correction factors
const PITCH_MULTIPLIERS: Record<string, number> = {
  flat:   1.00,  // 0/12 to 1/12
  low:    1.07,  // 2/12 to 4/12  (~15° slope)
  medium: 1.18,  // 5/12 to 8/12  (~25° slope)
  steep:  1.36,  // 9/12 and up   (~37° slope)
};

export function polygonToFootprintSqft(feature: GeoJSON.Feature<GeoJSON.Polygon>): number {
  const sqMeters = area(feature);
  return sqMeters * SQMETERS_TO_SQFT;
}

export function applyPitchMultiplier(footprintSqft: number, pitch: string): number {
  const multiplier = PITCH_MULTIPLIERS[pitch] ?? 1.0;
  return Math.round(footprintSqft * multiplier);
}
```

---

### Pattern 6: API Key Delivered via Config Endpoint

**What:** Add `googleMapsApiKey` to the existing `/api/config/:companyId` response. The widget already fetches this endpoint on mount. No new network round-trip required.

**Why not bake the key into the widget at build time:**

- The widget IIFE is a cached static asset. Key rotation would require a cache-busting rebuild + redeployment.
- The key is visible in DevTools network tab regardless — runtime delivery is not meaningfully less secure than build-time baking.
- Cloudflare Workers environment secrets (`GOOGLE_MAPS_API_KEY` in `wrangler.toml`) are the correct place for secrets.

**Security model (standard for browser-side Maps JS API keys):**

1. Restrict the key on Google Cloud Console to HTTP Referrers: the widget's API host domain (e.g., `*.roofingcalc.com/*`)
2. API restrictions: enable only Maps JavaScript API + Places API (New)
3. The referrer restriction is the primary defense — the key is intentionally public-facing

Do NOT proxy Maps API calls through Cloudflare Workers. The Maps JS API is specifically designed for browser-side use with HTTP referrer restrictions. Proxying adds latency, complexity, and additional billing surface.

```typescript
// packages/api/src/types.ts
export type Bindings = {
  DB: D1Database;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ESTIMATE_RATE_LIMITER?: RateLimit;
  LOGOS_BUCKET: R2Bucket;
  API_BASE_URL?: string;
  GOOGLE_MAPS_API_KEY: string;  // add this
};

// packages/api/src/routes/config.ts — add to response object
googleMapsApiKey: c.env.GOOGLE_MAPS_API_KEY,
```

---

## Data Flow

### Address → Map → Polygon → sqft → Estimate

```
[User types address in AddressInput]
    ↓
AutocompleteSuggestion.fetchAutocompleteSuggestions() → renders portal dropdown
    ↓
User selects suggestion
    ↓
place.fetchFields({ fields: ['location', 'formattedAddress'] })
    ↓
mapAddress.value = place.formattedAddress
mapCoords.value = { lat, lng }
    ↓ (RoofMap reacts to mapCoords signal)
RoofMap mounts → google.maps.importLibrary('maps') (already bootstrapped)
    ↓
new google.maps.Map(containerEl, { mapTypeId: 'satellite', center: mapCoords })
    ↓
Terra Draw initialized with polygon mode
    ↓
User traces roof outline on satellite image
    ↓
draw.on('change') → getSnapshot() → GeoJSON polygon
    ↓
polygonToFootprintSqft(feature)
    ↓
mapFootprintSqft.value = footprintSqft
    ↓ (SquareFootageConfirm reads both signals)
formData.value.sqft = applyPitchMultiplier(footprintSqft, formData.value.pitch)
    ↓
User confirms (or edits sqft manually)
    ↓
[Next] → ContactInfo → existing estimate API call (unchanged)
```

### State Changes to form.ts

```typescript
// Add to existing signals in state/form.ts:
export const mapAddress = signal('');
export const mapCoords = signal<{ lat: number; lng: number } | null>(null);
export const mapFootprintSqft = signal<number | null>(null);  // pre-pitch footprint sqft
export const mapMeasurementUsed = signal(false);  // for logging/analytics later

// Existing formData.sqft remains the single source of truth consumed by the estimate API.
// The map calculation writes into formData.sqft. Manual edit overrides it.
// No changes to ContactInfo, EstimateDisplay, or api/client.ts submitEstimate().
```

---

## Shadow DOM Gotchas

### Gotcha 1: Google Maps Script Tag Must Go in `document.head`, Not Shadow DOM

Scripts inserted into a Shadow DOM are not executed by browsers. The Maps JS API bootstrap `<script>` must be appended to `document.head`. This is fine — the script is invisible to the user and does not affect Shadow DOM CSS isolation.

### Gotcha 2: Map Container Must Have an Explicit Height

The existing `widget.css` applies `all: initial` to `:host`. This resets inherited height. The map container `<div>` will render as 0px unless a height is explicitly set:

```css
.rc-map-container {
  width: 100%;
  height: 320px;   /* explicit — required for Google Maps */
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 12px;
}
```

320px is a reasonable default for mobile (fits above the fold on a 667px-tall iPhone SE). Adjust if needed.

### Gotcha 3: Autocomplete Dropdown Must Be in `document.body`

A `<ul>` rendered inside the Shadow DOM for autocomplete suggestions will be clipped by the Shadow DOM container's `overflow` and will not layer correctly over the host site. Use the portal pattern: render the dropdown as a direct child of `document.body` with `position: fixed`.

### Gotcha 4: `document.activeElement` Does Not Pierce Shadow DOM

If any Google Maps internal code references `document.activeElement` to determine keyboard focus, it will not see inputs inside our Shadow DOM. In practice this only affects keyboard shortcut handling. Listen to events directly on the input/map element rather than delegating from `document`.

### Gotcha 5: CSS Custom Properties Inherit Through Shadow DOM Boundaries

`--rc-primary` (the company brand color) is set on the outer `rc-widget` div and is accessible inside the Shadow DOM. Use it for the "Confirm measurement" button to maintain brand consistency. Google Maps' own UI controls (zoom, satellite toggle) are styled by Google — they do not inherit our CSS.

### Gotcha 6: Terra Draw Canvas Layers Must Be Within the Map Container

Terra Draw renders SVG/canvas overlays as children of the `google.maps.Map` container element. Since this container is inside the Shadow DOM, Terra Draw's rendering works correctly without any special handling.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Google Maps JS API | Runtime `<script>` in `document.head`; `importLibrary()` for lazy per-library loading | Confirm `loading=async` flag to avoid blocking host page |
| Google Places (New) | `importLibrary('places')` → `AutocompleteSuggestion.fetchAutocompleteSuggestions()` | Legacy `AutocompleteService` not available to new customers as of March 2025 |
| Terra Draw | npm dependency, bundled in IIFE | Google's recommended DrawingManager replacement; supports GeoJSON output |
| @turf/area | npm sub-package, bundled in IIFE | Sub-package only — do not import full @turf/turf |

### Internal Boundaries (New vs. Existing)

| Boundary | Communication | Notes |
|----------|---------------|-------|
| AddressInput → RoofMap | `mapCoords` signal (RoofMap reacts via signal subscription) | Decoupled — no prop threading through RoofDetails |
| PolygonDrawing → form.ts | Writes `mapFootprintSqft` signal; SquareFootageConfirm reads and applies pitch | Pitch selection happens before or during draw — user picks pitch, then draws |
| SquareFootageConfirm → form.ts | Writes `formData.sqft` (same field existing code reads) | ContactInfo and EstimateDisplay see no change at all |
| config endpoint → widget | `googleMapsApiKey` added to existing JSON response | Piggybacked, no new RTT |
| ContactInfo, EstimateDisplay | No changes — they read `formData.sqft` regardless of how it was populated | Zero regression risk to existing steps |

---

## Suggested Build Order

Dependencies determine order. Each item must be testable in isolation before proceeding.

| Step | Task | Unblocks |
|------|------|----------|
| 1 | Add `GOOGLE_MAPS_API_KEY` to Cloudflare Workers env + config response | Everything Maps-related |
| 2 | `utils/area.ts` with unit tests (Shoelace/Turf, pitch multipliers) | PolygonDrawing |
| 3 | `utils/mapsLoader.ts` (bootstrap + importLibrary wrapper) | AddressInput, RoofMap |
| 4 | Add new signals to `state/form.ts` | All new components |
| 5 | `AddressInput` component (programmatic autocomplete + portal dropdown) | RoofMap (needs coords) |
| 6 | `RoofMap` component (satellite map centered on coords) | PolygonDrawing (needs Map instance) |
| 7 | `PolygonDrawing` component (Terra Draw polygon mode → sqft) | SquareFootageConfirm |
| 8 | `SquareFootageConfirm` component (pre-filled sqft, material/pitch pickers) | RoofDetails wiring |
| 9 | `RoofDetails` orchestration (sub-step A/B/C state machine, skip/fallback path) | Full E2E flow |
| 10 | Fallback path verification (skip map → manual sqft entry) | Regression safety |

Steps 2-4 can be done in parallel. Steps 5-8 are sequential by dependency. Step 10 is a test pass, not implementation.

---

## Anti-Patterns

### Anti-Pattern 1: Using `PlaceAutocompleteElement` Inside Shadow DOM

**What people do:** `shadowRoot.appendChild(new google.maps.places.PlaceAutocompleteElement({}))`

**Why it's wrong:** The element has a closed inner Shadow DOM — CSS from `widget.css` cannot reach its internal input. The `.pac-container` dropdown positions incorrectly due to viewport coordinate mismatch with nested Shadow DOMs.

**Do this instead:** Use `AutocompleteSuggestion.fetchAutocompleteSuggestions()` programmatically. Render a standard `<input class="rc-input">` inside the Shadow DOM. Render the suggestions dropdown as a `document.body` portal.

---

### Anti-Pattern 2: Bundling the Google Maps JS API Into the IIFE

**What people do:** Import from an npm wrapper that bundles the Maps API, or attempt to Vite-bundle google maps imports.

**Why it's wrong:** The Maps JS API is ~800KB. The CDN version is globally cached. Bundling it would take the widget from 28KB to ~1MB+ gzipped, breaking the embed-size constraint and defeating CDN caching.

**Do this instead:** Append a `<script>` tag to `document.head` at runtime. Call `google.maps.importLibrary()` for per-library lazy loading. The API key is already available from the config fetch.

---

### Anti-Pattern 3: Using DrawingManager for Polygon Drawing

**What people do:** `new google.maps.drawing.DrawingManager({ drawingMode: 'polygon' })`

**Why it's wrong:** DrawingManager was **deprecated August 2025** and will be **removed from the Maps JS API in May 2026**. Code written today will break in ~2 months from the project start date.

**Do this instead:** Use Terra Draw with `TerraDrawGoogleMapsAdapter`. It is Google's own recommended replacement — the official Maps JS API documentation links to a Terra Draw example as the reference implementation.

---

### Anti-Pattern 4: Inline Area Calculation Without Unit Tests

**What people do:** Write the polygon-to-sqft math inline inside the component, skip tests because "it's just math."

**Why it's wrong:** Off-by-one errors in the pitch multipliers or using planar Shoelace on spherical lat/lng coordinates silently produce wrong estimates. The sqft → estimate calculation is the product's core value proposition. A 10% error in sqft produces a 10% error in the price range.

**Do this instead:** Extract `utils/area.ts` as a pure function. Write unit tests before writing the component. Test: a known house footprint, each pitch value, and the manual-entry fallback path (pitch multiplier = 1.0).

---

### Anti-Pattern 5: Baking the Google Maps API Key Into the Widget Build

**What people do:** `VITE_GOOGLE_MAPS_KEY=abc npm run build` — the key gets hardcoded into the bundle.

**Why it's wrong:** The bundle is a static cached asset. Key rotation requires a rebuild + cache busting. Per-company keys become impossible. The key is in the bundle forever even after rotation.

**Do this instead:** Return the key from `/api/config/:companyId` at runtime. It is already over HTTPS. Apply HTTP Referrer restrictions on the Google Cloud Console to restrict the key to the widget's API host domain. This is the standard, accepted model for browser-side Google Maps API keys.

---

## Scaling Considerations

| Scale | Architecture Notes |
|-------|--------------------|
| Single company testing | Bootstrap Maps API unconditionally when address step loads. No concern. |
| Multiple companies, shared key | Single `GOOGLE_MAPS_API_KEY` env var in Workers. HTTP Referrer restriction covers the API origin domain. All companies share billing. |
| Multiple companies, separate billing | Store per-company `googleMapsApiKey` in D1 `companies` table. Config endpoint returns company-specific key. Each company owns their own Google Cloud project. Future — not needed for v1.1. |
| High volume (1M+ map measurements/month) | Google Maps JS API: $7/1,000 loads after free tier. Places Autocomplete: ~$0.0028/request (session-based). Monitor via Google Cloud Console billing alerts. |

**First billing concern:** Each unique map load costs after 28,000 free loads/month. Each autocomplete session (typically 3-8 keystrokes + 1 place select) is treated as one session token billing event. At current pricing, a user completing the map flow costs ~$0.01-0.02 total.

---

## Sources

- [Load the Maps JavaScript API — Dynamic Library Import](https://developers.google.com/maps/documentation/javascript/load-maps-js-api) — HIGH confidence, official Google documentation
- [Place Autocomplete Widget (New) — PlaceAutocompleteElement](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new) — HIGH confidence, official Google documentation
- [Place Autocomplete Data API — Programmatic AutocompleteSuggestion](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data) — HIGH confidence, official Google documentation
- [Drawing Layer Deprecation Notice — August 2025, May 2026 removal](https://developers.google.com/maps/documentation/javascript/drawinglayer) — HIGH confidence, official Google documentation
- [Draw on a map using Terra Draw — Official Google Maps JS API Example](https://developers.google.com/maps/documentation/javascript/examples/map-drawing-terradraw) — HIGH confidence, Google-authored example
- [Terra Draw GitHub — JamesLMilner/terra-draw](https://github.com/JamesLMilner/terra-draw) — HIGH confidence, library source
- [Google Maps Platform Security Guidance — API Key Restrictions](https://developers.google.com/maps/api-security-best-practices) — HIGH confidence, official guidance
- [PlaceAutocompleteElement Shadow DOM Styling Deep Dive](https://juancrg90.me/posts/mastering-google-places-new-api/) — MEDIUM confidence, practitioner post with code examples
- [Drawing Library Deprecation Discussion — react-google-maps](https://github.com/visgl/react-google-maps/discussions/825) — MEDIUM confidence, corroborates official deprecation notice
- [Places Autocomplete not available to new customers — March 2025](https://github.com/visgl/react-google-maps/issues/736) — MEDIUM confidence, corroborates official migration notice

---

*Architecture research for: Google Maps roof measurement integration into Preact Shadow DOM widget*
*Researched: 2026-03-10*
