# Feature Research

**Domain:** Address-to-satellite-view polygon roof measurement (v1.1 addition to existing estimate widget)
**Researched:** 2026-03-10
**Confidence:** HIGH (Google official docs verified March 2026, existing codebase inspected)

---

## Context: What Already Exists

The v1.0 widget `RoofDetails` step (step 0 of 3) has:
- Manual `sqft` number input (100–10,000 range, validated in `RoofDetails.tsx`)
- `pitch` dropdown (flat/low/medium/steep, maps to pricing multipliers)
- `material` dropdown (3-tab, architectural, standing-seam-metal)
- Preact signals state in `form.ts` — `formData.sqft`, `formData.pitch`, `formData.material`

The new measurement feature enhances step 1. It does NOT add a new step (4-step max is a hard constraint). It feeds the existing `formData.sqft` signal and optionally adds `formData.address`.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that define a usable satellite roof measurement experience. Any of these missing = the tool feels broken or amateur.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Address autocomplete input | Every mapping tool starts with address search. Typing a full address and hoping the map goes to the right place is a trust-killer. | LOW | Use `PlaceAutocompleteElement` (new Places API widget). Fires `gmp-select` event. Returns `place.location` (LatLng) after `fetchFields(['location', 'formattedAddress'])`. Do NOT use legacy `Autocomplete` class. |
| Satellite map centered on address | Users expect to see their roof immediately after address selection. A generic map at city level is useless. | LOW | Set `mapTypeId: 'hybrid'` (satellite + street labels), zoom 19. Wire `gmp-select` → `map.panTo(place.location)` + `map.setZoom(19)`. Hybrid over pure satellite so users can confirm the right address via labels. |
| Polygon drawing tool | The core mechanic. Click corners around the roof outline to define the area. This is what every satellite measurement tool does. | MEDIUM | Google's `DrawingManager` is **deprecated August 2025, unavailable May 2026**. Must use Terra Draw (`TerraDrawPolygonMode`) instead. Terra Draw is Google's documented replacement for the drawing library. |
| Real-time area display while drawing | Users expect to see a sqft number update as they add vertices. Without live feedback, they don't know if they're measuring correctly. | MEDIUM | Listen to Terra Draw `draw.on('change', callback)`. On each change, call `draw.getSnapshot()`, extract the in-progress polygon coordinates, run `google.maps.geometry.spherical.computeArea()` (returns sq meters × 10.764 = sq feet). |
| Auto-fill sqft field on polygon close | The measured value must flow into the existing form automatically. Requiring users to manually read and re-type a number defeats the purpose. | LOW | On polygon completion event, call `updateField('sqft', String(Math.round(calculatedSqft)))` — this writes to the existing `formData` signal. The existing sqft input shows the pre-filled value. |
| Manual sqft fallback | Users on mobile (harder to draw), or who already know their sqft from an insurance doc, should not be forced through the map. | LOW | The existing sqft number input must remain visible and editable alongside or below the map. Map measurement pre-populates it; user can override by typing. Both paths write to `formData.sqft`. |
| Undo last point | Users will misclick. Mobile users especially. No undo = polygon is ruined = user abandons the form. | LOW | Terra Draw `TerraDrawSelectMode` supports vertex deletion. Alternatively, track vertex array and pop last point manually with a button. Simpler: just provide a "Clear and restart" button if vertex-level undo is complex. |
| Clear and start over | If the polygon is badly placed, users need a full reset to retrace from scratch. | LOW | Call `draw.clear()` on the Terra Draw instance, reset the displayed sqft to "–". Do not reset `formData.sqft` until a new polygon is closed. |

### Differentiators (Competitive Advantage)

Features that go beyond baseline and increase conversion or estimate credibility.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Pitch-adjusted sqft auto-calculation | The footprint area traced on the satellite is NOT the actual roof surface area. A steep roof covers more material than its flat footprint. Auto-applying the pitch multiplier gives a more accurate sqft for the estimate — and educates the homeowner. | LOW | Formula: `footprint_sqft × pitch_multiplier`. Pitch multipliers already exist in the pricing engine (flat=1.00, low=1.05, medium=1.12, steep=1.25). Read `formData.pitch`, apply multiplier, write adjusted sqft. Display both: "Footprint: 1,200 sqft → Roof surface (Medium pitch): 1,344 sqft" |
| "Measure my roof" toggle / mode switcher | Surfaces the feature without forcing it. A toggle clearly separates "I know my sqft" from "help me measure it", reducing confusion and keeping the form familiar for users who don't want the map. | LOW | A two-option toggle above the sqft field: "Enter manually" (default) / "Measure on map". Show map panel below the toggle when "Measure on map" is selected. Map and its dependencies load lazily only when this mode is activated — critical for bundle size. |
| Address string included in lead email | Roofing companies receive the property address alongside the sqft and contact info. Far more useful than an anonymous sqft number. Allows them to look up the property before calling the lead. | LOW | Add `address` field to `formData` signal. Populate on `gmp-select`. Include in the estimate POST body. Render in the Resend lead email template. Zero UX impact on the homeowner. |
| "Done drawing" button to close polygon | On mobile, precision-clicking the first vertex to close a polygon is nearly impossible. A "Done" button closes the polygon programmatically wherever the user stops. | LOW | Terra Draw supports programmatic polygon completion. Add a "Done" button that appears after ≥3 vertices are placed. Closes the polygon by connecting the last point back to the first. |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| AI / ML automatic roof detection | "Detect the roof automatically" sounds impressive and would eliminate user effort | Requires server-side satellite image processing, LIDAR, or expensive third-party APIs (EagleView, Nearmap charge $10–25 per address report). This is a different product with a different cost structure. Not viable for an embedded widget with no per-use pricing. | Manual polygon drawing takes 30 seconds and homeowners can do it |
| Exact pitch detection from satellite | Pitch drives cost — auto-detecting it would improve estimate accuracy | 2D top-down satellite imagery cannot determine roof pitch. Requires elevation data or AI models trained on stereo imagery. Every tool that claims this either uses rough heuristics or expensive data. | Keep existing pitch dropdown. It is fast, accurate, and the homeowner usually knows their roof pitch category. |
| Multiple roof sections / facets | Complex roofs (dormers, additions, L-shapes) have multiple planes | Multi-polygon UX requires state for each section (label, add, edit, delete), partial sums, and total rollup. This blows up the 4-step max constraint and the widget's simplicity goal. The drawing UI alone would require multiple screens. | Single polygon for the main roof plane. Instruct user to trace the largest section and note that dormers / additions may affect final pricing. The manual sqft fallback remains for users who know their actual roof area. |
| Google Maps Drawing Library (`DrawingManager`) | Many tutorials reference it; it's the "obvious" approach | **Deprecated August 2025. Unavailable from May 2026.** Building on it now means a forced rewrite before the widget reaches maturity. The migration window is already closing. | Terra Draw — explicitly listed as the Google-recommended replacement. Same polygon drawing capabilities, GeoJSON output, active maintenance. |
| Forcing map measurement (removing manual fallback) | "One clear path" — avoiding the choice | Many homeowners already have sqft from an insurance document, previous estimate, or county records. Forcing them through a satellite drawing step is friction for no gain. Mobile polygon drawing is meaningfully harder than desktop. Users who don't want to draw will abandon. | Keep manual entry as a peer option (the "Enter manually" toggle state), not a buried fallback link |
| Storing polygon GeoJSON in the database | "Complete data capture" | Polygon GeoJSON can be 500–5,000 bytes per shape. D1 is at 100K writes/day on free tier. No downstream use exists for polygon geometry in v1 — the sqft is all that matters. | Extract sqft from polygon client-side, discard the polygon. Store only `sqft` (number) and `address` (string). |
| Satellite-only map type (no labels) | Cleaner visual, fewer distractions | Homeowners need to confirm they're looking at the right property. Pure satellite images of residential areas are nearly indistinguishable without street names and address labels. Incorrect property measurement = wrong estimate = bad lead. | Use `mapTypeId: 'hybrid'` (satellite tiles + vector label overlay). Best of both worlds. |

---

## Feature Dependencies

```
PlaceAutocompleteElement (address input)
    └──requires──> Maps JavaScript API loaded (libraries: ['places', 'geometry'])
    └──enables──>  Map pan/zoom to address LatLng
    └──produces──> formData.address (string, for lead email)

Satellite map panel
    └──requires──> Maps JavaScript API loaded
    └──requires──> PlaceAutocompleteElement selection (to center on address)
    └──loads LAZILY (only when "Measure on map" toggle activated)

Terra Draw polygon mode
    └──requires──> Maps JavaScript API map instance
    └──requires──> terra-draw npm package (TerraDrawGoogleMapsAdapter + TerraDrawPolygonMode)
    └──produces──> GeoJSON polygon via draw.getSnapshot()

google.maps.geometry.spherical.computeArea()
    └──requires──> libraries: ['geometry'] included in API load
    └──requires──> Closed polygon LatLng array from Terra Draw snapshot
    └──produces──> Area in square meters → × 10.764 → footprint sqft

Pitch-adjusted sqft
    └──requires──> footprint sqft (from computeArea)
    └──requires──> formData.pitch (already exists — user must select pitch)
    └──produces──> roof surface sqft → written to formData.sqft

formData.sqft auto-fill
    └──requires──> Pitch-adjusted sqft calculation
    └──integrates-with──> Existing sqft input in RoofDetails.tsx (same field, same signal)
    └──does-not-replace──> Manual sqft entry (both paths write to same formData.sqft)

Address in lead email
    └──requires──> PlaceAutocompleteElement selection
    └──integrates-with──> formData signal (add optional `address` field)
    └──integrates-with──> API POST body Zod schema (add optional address string)
    └──integrates-with──> Lead email template (Resend, add address line)
```

### Dependency Notes

- **Maps API must load lazily.** The Google Maps JS bundle is large (not tree-shakeable). Loading it on widget mount would bloat every page the widget is on. Load only when the user activates "Measure on map" mode. Use dynamic `<script>` injection or the `@googlemaps/js-api-loader` package with deferred loading.
- **Both `places` and `geometry` libraries must be declared at load time.** The Maps JS API requires the `libraries` parameter at initialization. You cannot load them piecemeal after the fact.
- **Terra Draw is a separate npm package.** It is not bundled with the Maps API. Install `terra-draw` (Apache 2.0 license). It should also be lazily imported so it doesn't affect the base 28KB widget bundle.
- **Pitch dropdown must be selected before or after measurement.** The pitch-adjusted sqft calculation reads `formData.pitch`. If pitch has not been selected when the polygon is closed, display the raw footprint sqft and show a note: "Select a pitch above to apply surface area adjustment." Recalculate when pitch is selected.
- **`formData` needs one new field.** Add `address: ''` to the existing signal in `form.ts`. All other fields are unchanged.

---

## MVP Definition

### Launch With (v1.1 — this milestone)

- [ ] "Measure on map" / "Enter manually" toggle in RoofDetails step
- [ ] Address autocomplete input (`PlaceAutocompleteElement`, new Places API)
- [ ] Satellite (hybrid) map panel, lazy-loaded on toggle activation
- [ ] Polygon drawing via Terra Draw (`TerraDrawPolygonMode`)
- [ ] Real-time sqft display as polygon vertices are added
- [ ] "Done" button to close polygon (mobile UX)
- [ ] Undo last point OR Clear and restart button
- [ ] Auto-fill `formData.sqft` on polygon close (pitch-adjusted if pitch already selected)
- [ ] Pitch-adjustment notification ("Roof surface at [pitch] pitch: X sqft")
- [ ] Manual sqft entry remains fully functional as the default path
- [ ] `formData.address` populated from autocomplete, included in lead email

### Add After Validation (v1.2)

- [ ] Pitch recalculation when pitch changes AFTER measurement — trigger: user confusion bug reports (currently needs manual re-measure or override)
- [ ] "My location" geolocation button — trigger: mobile usage data shows address typing friction
- [ ] Map confirmation thumbnail in the estimate display step — trigger: feedback that estimate feels abstract without a visual

### Future Consideration (v2+)

- [ ] Multi-polygon for complex roofs (dormers, additions) — trigger: contractor feedback that single polygon is too inaccurate for certain roof types
- [ ] Saved address / measurement for return visits — trigger: evidence of return-visit use case
- [ ] AI-assisted polygon snapping to roof edges — trigger: if third-party APIs become affordable at scale

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Address autocomplete | HIGH | LOW | P1 |
| Satellite map display | HIGH | LOW | P1 |
| Terra Draw polygon mode | HIGH | MEDIUM | P1 |
| Real-time sqft display | HIGH | LOW | P1 |
| Auto-fill sqft field | HIGH | LOW | P1 |
| Manual fallback (already built) | HIGH | NONE | P1 |
| "Done" button to close polygon | HIGH (mobile) | LOW | P1 |
| Pitch-adjusted sqft | MEDIUM | LOW | P1 |
| Address in lead email | MEDIUM | LOW | P1 |
| Undo last point | MEDIUM | LOW | P1 |
| Mode toggle UI | MEDIUM | LOW | P1 |
| Geolocation button | LOW | LOW | P2 |
| Map thumbnail in estimate display | LOW | MEDIUM | P3 |
| Multi-polygon | LOW | HIGH | P3 |

**Priority key:**
- P1: Must have for v1.1 launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## UX Flow (Concrete)

The existing 3-step flow is unchanged in structure. Only Step 1 (RoofDetails) gains new content within its existing step boundary.

**Step 1 (RoofDetails) — enhanced layout:**

```
[ Get Your Roof Estimate ]

  ( Enter manually )   (* Measure on map )    ← toggle, defaults to "Enter manually"

  --- WHEN "MEASURE ON MAP" ACTIVE ---

  [ 123 Main St, Springfield, IL         ]    ← PlaceAutocompleteElement
    Dropdown predictions appear as user types
    On selection: map centers on address at zoom 19

  ┌─────────────────────────────────────────┐
  │                                         │
  │     [ satellite + labels map ]          │  ← 350px desktop / 220px mobile
  │                                         │
  │  Click to place roof corners.           │
  │  Footprint: 1,240 sqft                  │  ← live update
  │  Roof surface (Medium pitch): 1,389 sqft│  ← appears when pitch is set
  │                                         │
  └─────────────────────────────────────────┘

  [ Undo Last Point ]     [ Done Drawing ]    ← appears after 1st vertex placed
  [ Clear & Start Over ]                      ← appears after polygon closed

  --- EITHER MODE ---

  Square Footage:  [ 1389          ]          ← pre-filled from map OR typed manually
  Roof Pitch:      [ Medium      ▼ ]
  Material:        [ Architectural Shingles ▼ ]

  [ Next ]
```

**Key UX rules:**
1. Map mode is opt-in. Default to "Enter manually" so the widget looks identical to v1.0 for users who know their sqft.
2. The sqft field stays editable even after the map fills it. This is essential for homeowner trust and for correcting measurement errors.
3. On mobile, map height is 220px (not 350px) so the sqft/pitch/material selects remain accessible below without excessive scrolling.
4. Map type must be `hybrid` (not `satellite`). Labels help homeowners confirm they are looking at the correct property before tracing.
5. Pitch adjustment is displayed as an informational note, not a separate input. The pitch dropdown is the same one used for pricing — it does double duty.
6. Address autocomplete should be restricted to US addresses (the target market) using `componentRestrictions: { country: 'us' }`.

---

## Competitor Feature Analysis

| Feature | Roofr / EagleView (Pro) | mapscaping.com (Free) | Our v1.1 Approach |
|---------|-------------------------|-----------------------|-------------------|
| Address search | Google Places autocomplete | Nominatim (OpenStreetMap) | Google Places new API (more accurate for US residential) |
| Map source | Google or Nearmap tiles | OpenStreetMap / Leaflet | Google Maps hybrid (consistent with Google Places) |
| Drawing tool | Custom polygon editor | Leaflet.draw library | Terra Draw (Google's documented replacement for deprecated DrawingManager) |
| Area calculation | Server-side, in report | Client-side geodesic | Client-side via `geometry.spherical.computeArea()` — no server round-trip needed |
| Pitch adjustment | Separate pitch input | Manual angle input | Reads existing pitch dropdown, auto-adjusts immediately |
| Mobile support | Dedicated native app | Web, limited | Web — explicit mobile layout (smaller map, "Done" button to close polygon) |
| Multi-polygon | Yes | Yes | No for v1.1 — single polygon is sufficient for 90% of residential roofs |
| Forced flow | Map required | Map required | Toggle — map is opt-in, manual entry is default |
| Price | $10–$25 per report (pro tools) | Free | Free — embedded in the estimate widget |

---

## API Constraints and Costs

**Google Maps JavaScript API — map loads:**
- $7 per 1,000 dynamic map loads (after monthly free credit)
- Each widget session where user activates "Measure on map" = 1 load event
- At 1,000 map-mode activations/month → ~$7/month. At 10,000 → ~$70/month.
- Lazy loading (only on toggle) means users who use manual entry generate no cost.
- Confidence: MEDIUM (pricing page consulted; Google restructured pricing March 2025)

**Google Places Autocomplete:**
- `PlaceAutocompleteElement` is session-based: autocomplete requests are free within a session
- `place.fetchFields()` triggers a Place Details charge (~$17/1,000 requests for basic fields)
- At 1,000 address lookups/month → ~$17/month
- Confidence: MEDIUM (verified against Google Places billing docs)

**Terra Draw:**
- Open source, Apache 2.0 license, zero API costs
- Bundle: ~50KB minified (lazy import — does not affect base 28KB widget bundle)

**API key exposure:**
The Google Maps API key will be visible in the widget bundle (this is unavoidable and is normal for client-side Maps embeds). Mitigate by restricting the key to specific HTTP referrers in Google Cloud Console — set allowed referrers to the domains of companies using the embed.

---

## Sources

- [Drawing Layer deprecation — Google official docs](https://developers.google.com/maps/documentation/javascript/drawinglayer) — confirmed August 2025 deprecation, May 2026 removal
- [Terra Draw Google Maps example — Google official docs](https://developers.google.com/maps/documentation/javascript/examples/map-drawing-terradraw) — updated 2026-03-02, documents `TerraDrawGoogleMapsAdapter` and `TerraDrawPolygonMode`
- [Terra Draw GitHub](https://github.com/JamesLMilner/terra-draw) — TerraDrawPolygonMode, GeoJSON output, Google Maps adapter; Apache 2.0
- [Place Autocomplete Widget — Google Maps Platform](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new) — `PlaceAutocompleteElement`, `gmp-select` event, `fetchFields()`
- [Autocomplete session pricing — Google Maps Platform](https://developers.google.com/maps/documentation/javascript/session-pricing) — session-based billing for autocomplete
- [Geometry Library — Google Maps Platform](https://developers.google.com/maps/documentation/javascript/geometry) — `computeArea()` returns sq meters; × 10.764 = sq feet
- [Google Maps Platform pricing](https://developers.google.com/maps/billing-and-pricing/pricing) — dynamic maps $7/1K, Places Details ~$17/1K
- [react-google-maps Drawing Library deprecation discussion](https://github.com/visgl/react-google-maps/discussions/825) — community confirmation, Terra Draw recommended
- [Mapscaping free roof area calculator](https://mapscaping.com/free-interactive-roof-area-calculator/) — UX reference for address → satellite → polygon → area → pitch adjustment flow
- [1ESX: How to Measure a Roof from Satellite 2026](https://www.1esx.com/how-to-measure-a-roof-from-a-satellite-for-free-a-2026-guide/) — typical polygon tool UX patterns

---
*Feature research for: Google Maps Roof Measurement (v1.1 milestone)*
*Researched: 2026-03-10*
