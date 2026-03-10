# Phase 5: Map Infrastructure + Address Autocomplete - Research

**Researched:** 2026-03-10
**Domain:** Google Maps JavaScript API (Places Autocomplete + Satellite Map), Cloudflare Workers secrets, Preact Shadow DOM portals
**Confidence:** HIGH

## Summary

Phase 5 establishes the foundational Google Maps plumbing the remaining map phases depend on. The work splits into three distinct concerns: (1) securely delivering the Maps API key from the Cloudflare Worker to the browser, (2) lazily bootstrapping the Maps JS API via CDN-injected script only when the homeowner activates map mode, and (3) implementing address autocomplete using the `AutocompleteSuggestion` API (the current, non-deprecated API as of March 2025) with session tokens for cost control.

The project has already locked several critical decisions captured in STATE.md. The `AutocompleteSuggestion` API (not the legacy `AutocompleteService`) is mandatory because new API keys created after March 2025 cannot access the legacy service. The autocomplete dropdown must be rendered as a `document.body` portal because Shadow DOM prevents nested dropdown positioning from working correctly. The Maps JS API must load lazily via CDN script injection rather than being bundled, because `inlineDynamicImports: true` in the widget's Vite config prevents code splitting — any import in the bundle is inlined.

The key security nuance for 2026: Google Maps API keys exposed in browser JavaScript can now implicitly access the Gemini API if Gemini is enabled on the same GCP project. The mitigation is to explicitly restrict the API key to only "Maps JavaScript API" and "Places API (New)" in the GCP console — HTTP referrer restrictions alone are insufficient because they can be bypassed via header manipulation.

**Primary recommendation:** Add a `GET /api/maps-key` endpoint to the Hono Worker that reads `GOOGLE_MAPS_API_KEY` from the Workers secret binding and returns it as JSON. The widget fetches this key on map-mode activation, then uses it to inject the Maps bootstrap loader into `document.head`.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MAP-01 | User can type an address and see autocomplete suggestions | `AutocompleteSuggestion.fetchAutocompleteSuggestions()` with session token; dropdown rendered as `document.body` portal to escape Shadow DOM |
| MAP-02 | Map displays satellite/hybrid view centered on selected address at roof-level zoom | `new google.maps.Map()` with `mapTypeId: 'hybrid'` and `zoom: 20`; center set via `place.location` from `fetchFields` |
| MAP-03 | Google Maps API loads lazily only when user activates map mode | CDN bootstrap loader injected into `document.head` at map-step activation; no bundle impact due to `inlineDynamicImports: true` constraint |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Google Maps JS API | weekly channel | Map rendering + Places autocomplete | Only option; loaded via CDN, not bundled |
| @preact/signals | ^1 (already installed) | Reactive state for map mode, key fetch, suggestions | Already used in widget; zero new dependency |
| Preact | ^10 (already installed) | Component rendering including portal | Already installed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| preact/compat createPortal | built-in | Render autocomplete dropdown to `document.body` | Required for any dropdown that must escape Shadow DOM |
| Hono (already installed) | ^4 | New `/api/maps-key` endpoint on Cloudflare Worker | Consistent with existing API routes |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Inline bootstrap loader injection | `@googlemaps/js-api-loader` npm package | npm package would be bundled — 9KB gzipped added to widget, violates bundle size constraint |
| `document.body` portal dropdown | Shadow DOM internal dropdown | Shadow DOM clip regions break absolute-positioned dropdowns that exceed the widget boundary |
| `GET /api/maps-key` Worker endpoint | Hardcode key in widget bundle | Hardcoded key is permanently exposed; Worker endpoint allows key rotation without redeployment |

**Installation:** No new npm packages required. Google Maps loads via CDN script injection at runtime.

---

## Architecture Patterns

### Recommended Project Structure
```
packages/
├── api/src/routes/
│   └── maps.ts          # new: GET /api/maps-key endpoint
├── api/src/types.ts     # add GOOGLE_MAPS_API_KEY to Bindings
├── widget/src/
│   ├── maps/
│   │   ├── loader.ts    # injects bootstrap script, exposes importMapsLibrary()
│   │   ├── autocomplete.ts  # AutocompleteSuggestion wrapper, session token lifecycle
│   │   └── types.ts     # PlacePrediction result type used across map phases
│   ├── components/
│   │   ├── AddressAutocomplete.tsx  # input + portal dropdown
│   │   └── MapView.tsx              # google.maps.Map container
│   └── state/
│       └── map.ts       # map-mode signal, selected place signal, apiKey signal
```

### Pattern 1: Lazy CDN Loader
**What:** Inject the Google Maps bootstrap script into `document.head` on demand, return a promise that resolves once `google.maps.importLibrary` is available.
**When to use:** Called exactly once, the first time the homeowner activates map mode. Subsequent calls return the already-resolved promise.

```typescript
// Source: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
// packages/widget/src/maps/loader.ts

let loaderPromise: Promise<void> | null = null;

export function loadMapsApi(apiKey: string): Promise<void> {
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise<void>((resolve, reject) => {
    // Guard: already loaded by host page
    if (typeof google !== 'undefined' && google?.maps?.importLibrary) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    // The minified bootstrap loader from Google — sets up google.maps.importLibrary()
    // without loading any map code yet.
    script.textContent = `(g=>{var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;b=b[c]||(b[c]={});var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams,u=()=>h||(h=new Promise(async(f,n)=>{await (a=m.createElement("script"));e.set("libraries",[...r]+"");for(k in g)e.set(k.replace(/[A-Z]/g,t=>"_"+t[0].toLowerCase()),g[k]);e.set("callback",c+".maps."+q);a.src=\`https://maps.\${c}apis.com/maps/api/js?\`+e;d[q]=f;a.onerror=()=>h=n(Error(p+" could not load."));a.nonce=m.querySelector("script[nonce]")?.nonce||"";m.head.append(a)}));d[l]?console.warn(p+" only loads once. Ignoring:",g):d[l]=(f,...n)=>r.add(f)&&u().then(()=>d[l](f,...n))})({key:"${apiKey}",v:"weekly"});`;
    script.onerror = () => reject(new Error('Google Maps bootstrap failed to load'));
    // Resolve once the bootstrap is parsed — importLibrary() is now available
    script.onload = () => resolve();
    // Inline scripts execute synchronously; use a minimal async wrapper
    document.head.appendChild(script);
    // Inline script (textContent) executes synchronously on append — resolve immediately
    resolve();
  });

  return loaderPromise;
}

export async function importMapsLibrary(name: string): Promise<unknown> {
  return (window as any).google.maps.importLibrary(name);
}
```

**Important:** The bootstrap loader's `textContent` is an inline script (not a `src=` script), so `onload` does not fire — it executes synchronously on `appendChild`. Call `resolve()` after `appendChild` instead.

### Pattern 2: AutocompleteSuggestion with Session Tokens
**What:** Fetch address predictions as the user types. Create a new session token per user typing session. Discard and recreate the token only after a place is selected and `fetchFields` completes.
**When to use:** On every `input` event with debounce (300ms). Token persists across multiple keystrokes in one session.

```typescript
// Source: https://developers.google.com/maps/documentation/javascript/place-autocomplete-data
// packages/widget/src/maps/autocomplete.ts

export interface PlacePredictionResult {
  text: string;
  placeId: string;
  mainText: string;
}

export interface SelectedPlace {
  formattedAddress: string;
  lat: number;
  lng: number;
}

let sessionToken: any = null;

export async function fetchSuggestions(input: string): Promise<PlacePredictionResult[]> {
  const { AutocompleteSuggestion, AutocompleteSessionToken } =
    await (window as any).google.maps.importLibrary('places') as any;

  if (!sessionToken) {
    sessionToken = new AutocompleteSessionToken();
  }

  const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
    input,
    sessionToken,
    // Restrict to addresses and establishments (roofing context)
    includedPrimaryTypes: ['street_address', 'premise', 'subpremise', 'street_number'],
    language: 'en-US',
    region: 'us',
  });

  return suggestions.map((s: any) => ({
    text: s.placePrediction.text.toString(),
    placeId: s.placePrediction.placeId,
    mainText: s.placePrediction.mainText?.toString() ?? s.placePrediction.text.toString(),
  }));
}

export async function resolvePlaceLocation(suggestion: any): Promise<SelectedPlace> {
  // toPlace() + fetchFields() ENDS the billing session for the token
  const place = suggestion.toPlace();
  await place.fetchFields({ fields: ['formattedAddress', 'location'] });

  // Discard used token — next search will create a fresh one
  sessionToken = null;

  return {
    formattedAddress: place.formattedAddress ?? '',
    lat: place.location.lat(),
    lng: place.location.lng(),
  };
}
```

### Pattern 3: Maps API Key Endpoint (Cloudflare Worker)
**What:** A new `GET /api/maps-key` Hono route that reads `GOOGLE_MAPS_API_KEY` from Workers secrets and returns it to authenticated callers.
**When to use:** Called once when map mode activates.

```typescript
// Source: existing pattern in packages/api/src/routes/config.ts
// packages/api/src/routes/maps.ts

import { Hono } from 'hono';
import type { Bindings } from '../types';

const maps = new Hono<{ Bindings: Bindings }>();

maps.get('/key', (c) => {
  const key = c.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return c.json({ error: 'Maps not configured' }, 503);
  }
  // No auth required — key is restricted by HTTP referrer + API restrictions in GCP console
  // Returning the key here is equivalent to embedding it in a script tag
  return c.json({ key });
});

export { maps };
```

```typescript
// packages/api/src/types.ts — add to Bindings
export type Bindings = {
  DB: D1Database;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ESTIMATE_RATE_LIMITER?: RateLimit;
  LOGOS_BUCKET: R2Bucket;
  API_BASE_URL?: string;
  GOOGLE_MAPS_API_KEY?: string;  // add this
};
```

### Pattern 4: Shadow DOM Portal for Autocomplete Dropdown
**What:** Render the autocomplete suggestions list into `document.body` using `createPortal` so that absolute positioning is not clipped by the Shadow DOM boundary.
**When to use:** Any dropdown, tooltip, or overlay that must appear outside the widget's Shadow DOM boundary.

```typescript
// Source: Preact compat API, consistent with React portal pattern
// packages/widget/src/components/AddressAutocomplete.tsx (excerpt)

import { createPortal } from 'preact/compat';

function SuggestionsDropdown({ suggestions, anchorRef, onSelect }: Props) {
  if (!suggestions.length) return null;

  const rect = anchorRef.current?.getBoundingClientRect();
  if (!rect) return null;

  const style = {
    position: 'fixed' as const,
    top: `${rect.bottom + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
    zIndex: 999999,
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    listStyle: 'none',
    margin: 0,
    padding: 0,
  };

  return createPortal(
    <ul style={style}>
      {suggestions.map((s) => (
        <li key={s.placeId} onClick={() => onSelect(s)} style={{ padding: '10px 14px', cursor: 'pointer' }}>
          {s.text}
        </li>
      ))}
    </ul>,
    document.body,
  );
}
```

**Note:** `position: fixed` avoids `scrollY` offset calculation and works better than `absolute` for portals rendered in `document.body`.

### Pattern 5: Map Initialization
**What:** Initialize `google.maps.Map` with hybrid satellite type at roof-level zoom.
**When to use:** After a place is selected from autocomplete.

```typescript
// Source: https://developers.google.com/maps/documentation/javascript/maptypes
// packages/widget/src/components/MapView.tsx (excerpt)

async function initMap(container: HTMLElement, lat: number, lng: number) {
  const { Map } = await (window as any).google.maps.importLibrary('maps') as any;
  return new Map(container, {
    center: { lat, lng },
    zoom: 20,              // roof-level: buildings clearly rendered
    mapTypeId: 'hybrid',   // satellite imagery with street labels
    disableDefaultUI: true,
    gestureHandling: 'greedy',  // important for single-finger pan on mobile
  });
}
```

**Zoom level 20** is the right default: buildings are fully rendered, residential roof outlines are visible. Use `MaxZoomService` in Phase 6 if needed for locations where zoom 20 imagery is unavailable.

**Important August 2025 change:** As of Maps JS API v3.62 (August 2025), satellite/hybrid map types no longer auto-switch to 45° imagery at higher zoom levels. Top-down view is maintained at all zoom levels, which is correct for roof tracing. No action needed.

### Anti-Patterns to Avoid

- **Bundling Maps JS**: Do not `import` anything from `@googlemaps/js-api-loader` or any Google Maps npm package in the widget. The `inlineDynamicImports: true` Vite config inlines all dynamic imports — there is no code splitting. CDN-only loading is the only option.
- **Reusing session tokens across selections**: Each `toPlace().fetchFields()` call consumes the token. Create a fresh `AutocompleteSessionToken` after every selection. Reusing the same token for a second search starts an invalid session and bills all requests at per-request rates.
- **No session token at all**: Without a session token, every keystroke in the autocomplete input is billed individually. The cost difference is 5-10x per address lookup.
- **Positioning dropdown inside Shadow DOM**: Absolute-positioned elements in Shadow DOM are clipped by the host widget's overflow. The dropdown will be cut off. Always portal to `document.body`.
- **Loading Maps API eagerly on widget mount**: The success criteria explicitly require zero network requests until map mode is activated (MAP-03). The loader must only run when the homeowner clicks "Measure on map".

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Address geocoding | Custom geocoder | `place.fetchFields({ fields: ['location'] })` after autocomplete selection | The Place object from autocomplete already contains lat/lng — no separate geocode call needed |
| Debounce on autocomplete input | Custom setTimeout wrapper | Standard `useRef` debounce pattern (300ms) | trivial but well-understood; no library needed |
| Script load detection | Polling `window.google` | Bootstrap loader's one-time promise guard | The loader pattern already handles "already loaded by host page" case |
| Map container sizing | Manual resize observer | Set explicit `height` on map container element | Maps JS API requires a height on the container or the map renders at 0px height (invisible) |

**Key insight:** The AutocompleteSuggestion API consolidates geocoding into the selection flow — there is no separate geocoding step needed for Phase 5.

---

## Common Pitfalls

### Pitfall 1: Inline Script textContent vs src onload
**What goes wrong:** Setting `script.textContent` and then listening for `onload` — the event never fires because inline scripts execute synchronously.
**Why it happens:** `onload` only fires for scripts loaded via `src=` (network fetch). Inline content scripts execute immediately on DOM insertion.
**How to avoid:** After `document.head.appendChild(script)` for a `textContent` script, call `resolve()` directly — no event listener needed.
**Warning signs:** Promise never resolves; map mode hangs.

### Pitfall 2: Session Token Billing Trap
**What goes wrong:** `fetchAutocompleteSuggestions` is called without a `sessionToken`, or the token is discarded before `fetchFields` is called.
**Why it happens:** Forgetting session tokens or creating a new one per keystroke.
**How to avoid:** Create one token per user interaction session. Reuse it across all keystrokes in that session. Discard only after `fetchFields` completes successfully.
**Warning signs:** Autocomplete costs on Google Cloud billing spike 5-10x vs expected.

### Pitfall 3: Map Container Height Zero
**What goes wrong:** The map div renders but no map is visible — it appears blank.
**Why it happens:** The Maps JS API requires the container to have an explicit non-zero height before initialization. Flex/grid layouts may report 0 until after paint.
**How to avoid:** Set `height: 300px` (or similar) as an inline style or CSS class on the map container element before calling `new Map()`.
**Warning signs:** Map div is present in DOM but visually empty.

### Pitfall 4: Google Maps Already on Host Page
**What goes wrong:** The host page also uses Google Maps. Injecting a second bootstrap loader triggers `"The Google Maps JavaScript API only loads once"` console warning and the second loader is silently ignored — but if the host's key differs, features may be unavailable.
**Why it happens:** The bootstrap loader's guard (`d[l]?console.warn`) prevents double initialization.
**How to avoid:** Check `typeof google !== 'undefined' && google?.maps?.importLibrary` before injecting. If already present, skip injection and use the existing API. Accept that the host's key will be used in this edge case. Document this limitation.
**Warning signs:** Console warning about API loading once; map features unavailable.

### Pitfall 5: Autocomplete Dropdown Click Lost to Shadow DOM
**What goes wrong:** Clicking a suggestion item in the portal dropdown causes the input to lose focus before the click handler fires — the dropdown closes before the selection is registered.
**Why it happens:** `onBlur` on the input (triggered by clicking outside the Shadow DOM) fires before `onClick` on the portal item.
**How to avoid:** Use `onMouseDown` with `event.preventDefault()` on dropdown items instead of `onClick`. This prevents the blur from firing before the selection is registered.
**Warning signs:** Clicking suggestions closes the dropdown without selecting anything.

### Pitfall 6: API Key Gemini Privilege Escalation
**What goes wrong:** The Maps API key is exposed in browser JavaScript (unavoidable for Maps JS API) and the GCP project also has Gemini API enabled — the key gains unauthorized Gemini access.
**Why it happens:** Google retroactively grants existing keys access to newly enabled APIs on the same GCP project (confirmed February 2026).
**How to avoid:** In the GCP Console, set API key restrictions to allow ONLY "Maps JavaScript API" and "Places API (New)". Do not enable Gemini or other sensitive APIs on the same GCP project as the Maps key.
**Warning signs:** Key accepted by Gemini API endpoints; unexpected billing.

---

## Code Examples

### Complete Lazy Load + Autocomplete Flow

```typescript
// Source: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
// Source: https://developers.google.com/maps/documentation/javascript/place-autocomplete-data

// 1. Fetch key from Worker
const { key } = await fetch(`${apiBase}/api/maps-key`).then(r => r.json());

// 2. Inject bootstrap loader (no network request yet — only sets up importLibrary)
await loadMapsApi(key);

// 3. User types — fetch suggestions (network request to Places API)
const suggestions = await fetchSuggestions(inputValue);

// 4. User selects — resolve location (terminates billing session)
const place = await resolvePlaceLocation(selectedSuggestion.raw);

// 5. Initialize map centered on selected property
await initMap(mapContainerEl, place.lat, place.lng);
```

### Wrangler Secret Setup

```bash
# Local dev: add to packages/api/.dev.vars
GOOGLE_MAPS_API_KEY=AIza...

# Production: set via wrangler
wrangler secret put GOOGLE_MAPS_API_KEY --cwd packages/api
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `AutocompleteService` | `AutocompleteSuggestion` | March 2025 (blocked for new keys) | Must use new API — legacy blocked |
| `DrawingManager` for polygons | Terra Draw (Phase 6 concern) | Deprecated August 2025, removed May 2026 | Phase 6 only |
| 45° imagery at high zoom | Top-down satellite at all zoom levels | v3.62, August 2025 | Good for roof tracing — consistent top-down |
| `libraries` param in script URL | `importLibrary()` dynamic loading | 2023 | Enables true lazy loading per-library |

**Deprecated/outdated:**
- `google.maps.places.AutocompleteService`: blocked for new API keys since March 2025
- `google.maps.places.Autocomplete` widget: legacy, not for new keys
- `DrawingManager`: deprecated August 2025, removed May 2026 (Phase 6 concern, not Phase 5)

---

## Open Questions

1. **Should `/api/maps-key` require authentication?**
   - What we know: The Maps JS API key must ultimately appear in browser JavaScript to call `google.maps.importLibrary`. Returning it from a Worker endpoint is equivalent in security to embedding it in the widget bundle. HTTP referrer restrictions in GCP are the real protection layer.
   - What's unclear: Whether a CORS-restricted endpoint (only accept requests from known widget origins) adds meaningful security over plain HTTP referrer restrictions.
   - Recommendation: Keep the endpoint unauthenticated for v1.1. Apply CORS to `*` (consistent with other `/api/*` routes). Document that GCP API key restrictions (referrer + API restriction to Maps/Places only) are the security boundary.

2. **What `includedPrimaryTypes` to use for address autocomplete?**
   - What we know: The AutocompleteSuggestion API accepts `includedPrimaryTypes` for filtering. For a roofing context, residential addresses are the primary target.
   - What's unclear: Whether `['street_address', 'premise']` or just omitting the filter gives better results for US residential addresses.
   - Recommendation: Start with no `includedPrimaryTypes` filter (broader results). Add filtering in Phase 6 if noise is observed.

3. **Debounce timing for autocomplete input?**
   - What we know: Standard practice is 200-300ms debounce on user input before calling `fetchAutocompleteSuggestions`.
   - Recommendation: Use 300ms. Reduces API calls without feeling sluggish.

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
| MAP-01 | `fetchSuggestions()` returns predictions from mocked API | unit | `cd packages/widget && npx vitest run test/autocomplete.test.ts` | Wave 0 |
| MAP-01 | Session token created on first call, reused on subsequent calls | unit | `cd packages/widget && npx vitest run test/autocomplete.test.ts` | Wave 0 |
| MAP-01 | Session token reset to null after `resolvePlaceLocation` | unit | `cd packages/widget && npx vitest run test/autocomplete.test.ts` | Wave 0 |
| MAP-01 | Dropdown renders in `document.body` portal, not inside shadow root | unit | `cd packages/widget && npx vitest run test/autocomplete.test.ts` | Wave 0 |
| MAP-02 | `initMap` called with correct lat/lng from selected place | unit | `cd packages/widget && npx vitest run test/maps-loader.test.ts` | Wave 0 |
| MAP-02 | Map initialized with `mapTypeId: 'hybrid'` and `zoom: 20` | unit | `cd packages/widget && npx vitest run test/maps-loader.test.ts` | Wave 0 |
| MAP-03 | `loadMapsApi` not called on widget mount, only on map mode activate | unit | `cd packages/widget && npx vitest run test/maps-loader.test.ts` | Wave 0 |
| MAP-03 | `loadMapsApi` called only once even if triggered multiple times | unit | `cd packages/widget && npx vitest run test/maps-loader.test.ts` | Wave 0 |
| MAP-03 | `GET /api/maps-key` returns key from Worker secret binding | unit | `cd packages/api && npx vitest run test/maps.test.ts` | Wave 0 |
| MAP-03 | `GET /api/maps-key` returns 503 when `GOOGLE_MAPS_API_KEY` is not set | unit | `cd packages/api && npx vitest run test/maps.test.ts` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/widget && npx vitest run`
- **Per wave merge:** `cd packages/widget && npx vitest run && cd ../api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/widget/test/autocomplete.test.ts` — covers MAP-01 (mock `google.maps.importLibrary`, test session token lifecycle, portal rendering)
- [ ] `packages/widget/test/maps-loader.test.ts` — covers MAP-02, MAP-03 (mock script injection, verify lazy load guard)
- [ ] `packages/api/test/maps.test.ts` — covers MAP-03 API endpoint (mock env binding, test 200/503 responses)

---

## Sources

### Primary (HIGH confidence)
- [Google Maps JS API - Place Autocomplete Data API](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data) — `AutocompleteSuggestion`, `fetchAutocompleteSuggestions`, session token pattern
- [Google Maps JS API - Load Maps JS API](https://developers.google.com/maps/documentation/javascript/load-maps-js-api) — bootstrap loader snippet, `importLibrary()` dynamic loading
- [Google Maps JS API - Autocomplete and session pricing](https://developers.google.com/maps/documentation/javascript/session-pricing) — session token billing structure, per-request vs session rates
- [Google Maps JS API - Map Types](https://developers.google.com/maps/documentation/javascript/maptypes) — `mapTypeId: 'hybrid'`, zoom levels, v3.62 change to 45° imagery
- [Google Maps Platform security guidance](https://developers.google.com/maps/documentation/javascript/get-api-key) — HTTP referrer restrictions, API restrictions
- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/) — `wrangler secret put`, `.dev.vars` for local dev
- [Place Autocomplete Data Predictions example](https://developers.google.com/maps/documentation/javascript/examples/place-autocomplete-data-simple) — verified code pattern

### Secondary (MEDIUM confidence)
- [Migration guide: AutocompleteService → AutocompleteSuggestion](https://developers.google.com/maps/documentation/javascript/legacy/places-migration-autocomplete) — confirmed legacy API blocked for new keys since March 2025
- [Autocomplete (New) and session pricing](https://developers.google.com/maps/documentation/places/web-service/session-pricing) — session rate structure cross-verified

### Tertiary (LOW confidence)
- [Truffle Security: Google API Keys + Gemini](https://trufflesecurity.com/blog/google-api-keys-werent-secrets-but-then-gemini-changed-the-rules) — Gemini privilege escalation via Maps key (February 2026); primary source content not fetchable, but independently corroborated by multiple secondary sources
- [Simon Willison writeup on Google API key risk](https://simonwillison.net/2026/Feb/26/google-api-keys/) — corroborates Gemini risk finding

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — confirmed by official Google Maps docs; no new npm dependencies required
- Architecture: HIGH — all patterns sourced from official documentation or verified against existing project structure
- API key delivery pattern: HIGH — confirmed `AutocompleteSuggestion` blocked for legacy, bootstrap loader confirmed
- Session token billing: HIGH — official Google billing docs confirm 5-10x cost difference
- Pitfalls: HIGH (inline script onload, session token, map height, dropdown blur) — verified against official docs and well-documented community issues; MEDIUM for Gemini key risk (corroborated multi-source but primary source not directly fetchable)
- Validation: HIGH — consistent with existing Vitest setup in widget and API packages

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable APIs; Maps JS API changes on `weekly` channel)
