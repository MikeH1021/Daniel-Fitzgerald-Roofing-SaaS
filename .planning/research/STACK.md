# Stack Research

**Domain:** Embeddable SaaS roofing widget — Google Maps roof measurement addition
**Researched:** 2026-03-10
**Confidence:** HIGH (all critical claims verified against official Google documentation)

---

## Context: What Already Exists

This is a subsequent-milestone research file. The following stack is validated and must NOT change:

| Package | Version | Role |
|---------|---------|------|
| Preact | ^10 | Widget UI |
| @preact/signals | ^1 | Reactive state |
| Vite | ^6 | Build tooling (IIFE bundle) |
| TypeScript | ^5.7 | Type safety |
| Hono | 4.x | API on Cloudflare Workers |
| Drizzle ORM | 0.45.x | D1 database queries |
| Zod | 3.x | Validation |
| Cloudflare Workers + D1 + R2 | GA | Infra |

Current widget bundle: **28KB gzipped IIFE**. Embed size is a hard constraint.

---

## New Stack Additions for v1.1

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Google Maps JavaScript API | weekly (loaded at runtime) | Satellite map display, coordinate system | The only API that provides satellite imagery + polygon geometry + Places autocomplete under one key. Loaded dynamically at runtime — does NOT add to widget bundle. |
| @googlemaps/js-api-loader | 2.0.2 | Dynamic script loader for Maps API | Official Google library. Handles deduplication (safe to call multiple times), `importLibrary()` async pattern, and TypeScript types. 61KB unpacked, but loaded as a runtime dependency alongside the Maps script itself — not bundled into the IIFE. |
| Place Autocomplete Data API | (part of Maps JS API `places` library) | Programmatic address autocomplete with session tokens | New customer requirement since March 1, 2025: `google.maps.places.Autocomplete` is blocked for new API keys. The Data API (`AutocompleteSuggestion`) is the current approach — fetches suggestions programmatically so we control the UI inside Shadow DOM. |
| Terra Draw | 1.25.0 | Polygon drawing on Google Maps | Official Google recommendation replacing the deprecated Drawing Library (deprecated Aug 2025, removed May 2026). Provides `TerraDrawPolygonMode` with click-to-place vertices and auto-close. GeoJSON output. |
| terra-draw-google-maps-adapter | 1.3.1 | Binds Terra Draw to a Google Maps instance | Separate adapter package per Terra Draw's architecture. Wraps the Google Maps `OverlayView` API. Required alongside the core `terra-draw` package. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `google.maps.geometry` | (part of Maps JS API) | `spherical.computeArea()` → square meters | After polygon is completed; convert sq meters → sq feet (× 10.7639). Load via `importLibrary("geometry")`. |
| `google.maps.places` | (part of Maps JS API) | `AutocompleteSuggestion.fetchAutocompleteSuggestions()` + `Place.fetchFields()` | Address autocomplete input. Load via `importLibrary("places")`. |
| `google.maps.maps` | (part of Maps JS API) | `Map` instance, `MapTypeId.SATELLITE` | Satellite map render. Load via `importLibrary("maps")`. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@types/google.maps` | TypeScript types for Maps JS API | Install as dev dependency in the widget package. Provides `google.maps.*` type definitions without bundling the API. |

---

## Installation

```bash
# In packages/widget
npm install @googlemaps/js-api-loader terra-draw terra-draw-google-maps-adapter

# Dev types (no runtime cost)
npm install -D @types/google.maps
```

The Maps JS API itself is NOT installed via npm — it loads at runtime via `@googlemaps/js-api-loader`.

---

## Google Maps API Pricing (March 2025 Pricing Model)

Google replaced the $200 monthly credit in March 2025 with per-SKU free monthly thresholds.

| SKU | Free Monthly | Paid Rate |
|-----|-------------|-----------|
| Maps JS API (Dynamic Maps) | 10,000 map loads | $7.00/1,000 (10K-100K) → scales down |
| Places Autocomplete Request | 10,000 requests | $2.83/1,000 (10K-100K) |
| Places Details (Essentials) | 10,000 requests | ~$5.00/1,000 |
| Geometry (computeArea) | No separate charge | Included in map load SKU |
| Polygon drawing | No separate charge | No dedicated SKU — uses map load |

**Session token strategy (critical for cost):** Use `AutocompleteSessionToken` to group all autocomplete keystrokes with the final Place Details fetch into one billable session. Without session tokens, every keystroke is billed individually. Session tokens are free — only the terminal `Place.fetchFields()` call is charged. At ~5 address lookups per estimate submission, session pricing keeps costs close to zero at normal volumes.

**Cost at scale:** With 10,000 map loads/month free, the first ~10,000 estimate widget interactions cost nothing. A roofing company doing 50 estimates/day × 30 days = 1,500 map loads/month — well within free tier for most early customers.

---

## Critical Integration Details

### Shadow DOM + Google Maps

Google Maps renders into a DOM element by reference, not by CSS selector. Pass a `div` ref from inside the Shadow DOM directly to `new google.maps.Map(divElement, options)`. This works correctly — verified by the Bitovi web components academy and existing custom element implementations.

```typescript
// In a Preact component, after mount:
const mapDivRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  if (mapDivRef.current) {
    const map = new google.maps.Map(mapDivRef.current, {
      mapTypeId: google.maps.MapTypeId.SATELLITE,
      zoom: 20,
    });
  }
}, []);
```

The map container div lives inside the Shadow DOM. Maps JS API uses that reference directly and renders correctly.

**Print CSS caveat (LOW severity):** Google Maps injects global print CSS into `document.head`. This CSS won't cascade into the Shadow DOM. Impact: map may not print well. Not a concern for this use case (interactive estimator widget, not printed).

### Shadow DOM + PlaceAutocompleteElement (avoid)

The `<gmp-place-autocomplete>` web component uses a **closed Shadow DOM** internally. Styling it to match the widget's design requires monkey-patching `Element.prototype.attachShadow` — fragile and not recommended. Use the **Place Autocomplete Data API** instead: build a native Preact `<input>` inside the widget's own Shadow DOM, call `AutocompleteSuggestion.fetchAutocompleteSuggestions()` on input events, render a custom dropdown. This approach:
- Uses standard Preact state/signals
- Fully styled with the widget's CSS variables
- No monkey-patching
- Session token support built in

### Terra Draw Inside Shadow DOM

Terra Draw renders its canvas/overlay via the Google Maps `OverlayView`, which attaches to the map's own panes (inside the Shadow DOM div). This works without special configuration. Terra Draw does not inject styles into `document.head`.

### Bundle Size Impact

The IIFE bundle must not include Maps JS API, Terra Draw, or the adapter. All three are runtime dependencies loaded when the user reaches the map step.

| Dependency | Load strategy | Size impact on IIFE |
|-----------|--------------|---------------------|
| Google Maps JS API | Dynamic script tag via loader | 0 KB added to bundle |
| @googlemaps/js-api-loader | **Bundled into IIFE** | ~4 KB gzipped |
| terra-draw | Lazy-imported at map step | 0 KB at initial load |
| terra-draw-google-maps-adapter | Lazy-imported at map step | 0 KB at initial load |
| @types/google.maps | Dev only | 0 KB (types only) |

Use Vite dynamic `import()` to lazy-load Terra Draw only when the user opts into the map measurement flow. The initial widget load remains ~32KB gzipped (up from 28KB, ~14% increase from bundling the loader).

```typescript
// Lazy load terra-draw only when map step is activated
const { TerraDraw, TerraDrawPolygonMode } = await import('terra-draw');
const { TerraDrawGoogleMapsAdapter } = await import('terra-draw-google-maps-adapter');
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Place Autocomplete Data API (programmatic) | `<gmp-place-autocomplete>` web component | Use the web component only when you control the full page and don't need custom styling. Inside Shadow DOM with strict design requirements, the Data API is correct. |
| Terra Draw polygon mode | Google Maps Drawing Library | Never for new projects — Drawing Library is deprecated August 2025, removed May 2026. |
| Terra Draw polygon mode | Custom click listener + `google.maps.Polygon` | Viable alternative. Fewer dependencies, more control. Higher implementation effort (manual vertex management, undo/redo, mobile touch). Terra Draw handles all of this. |
| Maps JS API (Google) | Mapbox GL JS | Mapbox has better vector tiles and styling. But requires a separate Mapbox key, different polygon API, and no Places autocomplete. Google Maps is the only option that unifies satellite imagery + autocomplete + geometry under one key. |
| Maps JS API (Google) | Leaflet + OpenStreetMap | No satellite imagery without a paid tile provider. Not appropriate for roof tracing. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `google.maps.drawing.DrawingManager` | Deprecated August 2025, removed May 2026. Any new implementation using it will break in a few months. | Terra Draw with `TerraDrawPolygonMode` |
| `google.maps.places.Autocomplete` (legacy class) | Blocked for new API keys since March 1, 2025. Will throw a console error and not function for any API key created after that date. | `google.maps.places.AutocompleteSuggestion` (Places Autocomplete Data API) |
| `google.maps.places.AutocompleteService` (legacy) | Blocked for new API keys since March 1, 2025. Same reason as above. | `google.maps.places.AutocompleteSuggestion` |
| `react-google-maps` or `@vis.gl/react-google-maps` | React-specific wrappers. This project uses Preact in an IIFE bundle — React adapter packages add React as a dependency, defeating the entire reason for using Preact. | Direct Maps JS API calls inside Preact components |
| `use-places-autocomplete` (npm hook) | React hook, same problem. Also relies on legacy Autocomplete API. | Custom Preact hook wrapping `AutocompleteSuggestion` |
| Bundling Maps JS API | ~450KB gzipped. Would destroy the widget bundle size constraint. | Runtime loading via `@googlemaps/js-api-loader` |

---

## Stack Patterns by Variant

**If the company has a Google Maps API key configured:**
- Load Maps API via `@googlemaps/js-api-loader` using that key
- Show "Measure on Map" button above the sqft input
- Flow: address autocomplete → satellite view → polygon draw → auto-fill sqft

**If no API key is configured (or key is missing/invalid):**
- Hide "Measure on Map" button entirely
- Fall through to manual sqft entry (existing behavior)
- No error shown to homeowner

**If the homeowner skips the map step:**
- Manual sqft entry remains fully functional
- No change to existing RoofDetails step behavior

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| terra-draw@1.25.0 | terra-draw-google-maps-adapter@1.3.1 | Must match major versions; both are actively maintained together |
| @googlemaps/js-api-loader@2.0.2 | Google Maps JS API weekly channel | Loader version is independent of Maps API version |
| Preact@10 | Terra Draw@1.x | Terra Draw is framework-agnostic; no compatibility concern |
| Vite@6 + dynamic import() | Terra Draw@1.x | Standard ESM dynamic import, works with Vite IIFE builds with `inlineDynamicImports: true` — **requires config adjustment** for lazy loading |

**Vite IIFE build config note:** The existing `vite.config.ts` sets `inlineDynamicImports: true`. This inlines all dynamic imports at build time (defeating lazy loading). To enable true lazy loading of Terra Draw, change the build to use a different strategy or accept that Terra Draw will be inlined into the IIFE. Given Terra Draw's size (3.9MB unpacked), evaluate whether to:
1. Accept it in the bundle (larger initial load)
2. Load via CDN script tag instead (avoids bundler entirely)
3. Restructure build to allow code splitting (complex for IIFE format)

**Recommendation:** Load Terra Draw and its adapter from a CDN (e.g., unpkg or jsDelivr) only when the map step is activated. This keeps the IIFE bundle small and leverages CDN caching across sites using the widget.

---

## Sources

- [Google Maps Deprecations page](https://developers.google.com/maps/deprecations) — Drawing Library deprecated August 2025, removed May 2026; legacy Autocomplete blocked for new keys March 1, 2025 (HIGH confidence, official)
- [Terra Draw on Google Maps (Official Example)](https://developers.google.com/maps/documentation/javascript/examples/map-drawing-terradraw) — Google's recommended replacement for Drawing Library (HIGH confidence, official)
- [Place Autocomplete Data API docs](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data) — `AutocompleteSuggestion`, session tokens, programmatic approach (HIGH confidence, official)
- [Place Autocomplete Widget docs](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new) — `PlaceAutocompleteElement` closed Shadow DOM, `gmp-select` event (HIGH confidence, official)
- [Google Maps Billing Pricing page](https://developers.google.com/maps/billing-and-pricing/pricing) — March 2025 pricing structure with per-SKU free thresholds (HIGH confidence, official)
- [Google Maps March 2025 pricing changes](https://developers.google.com/maps/billing-and-pricing/march-2025) — $200 credit replaced with free usage tiers (HIGH confidence, official)
- [Geometry Library reference](https://developers.google.com/maps/documentation/javascript/reference/geometry) — `spherical.computeArea()` returns square meters, `importLibrary("geometry")` pattern (HIGH confidence, official)
- [@googlemaps/js-api-loader GitHub releases](https://github.com/googlemaps/js-api-loader/releases) — v2.0.2 released October 29, 2025 (HIGH confidence, official)
- [terra-draw npm registry](https://www.npmjs.com/package/terra-draw) — v1.25.0, last published ~14 days prior to research date (HIGH confidence, npm registry)
- [Mastering Google Places new API — Shadow DOM styling](https://juancrg90.me/posts/mastering-google-places-new-api/) — closed Shadow DOM monkey-patch workaround, why to avoid it (MEDIUM confidence, community)
- [Bitovi web components academy — Map View](https://bitovi.github.io/academy/learn-web-components/map-view.html) — rendering Google Maps inside Shadow DOM via div reference (MEDIUM confidence, educational)

---
*Stack research for: Roofing widget v1.1 — Google Maps roof measurement*
*Researched: 2026-03-10*
