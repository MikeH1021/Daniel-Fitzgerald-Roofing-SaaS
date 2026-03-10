# Project Research Summary

**Project:** Roofing Calculator Widget — Google Maps Roof Measurement (v1.1)
**Domain:** Embeddable SaaS roofing estimate widget — satellite polygon measurement addition
**Researched:** 2026-03-10
**Confidence:** HIGH

## Executive Summary

This is a v1.1 milestone that adds satellite-based roof measurement to an existing, production-tested embeddable widget (v1.0, 28KB gzipped IIFE, Preact + Cloudflare Workers + D1). The new feature allows homeowners to look up their address on a Google Maps satellite view, trace their roof outline with a polygon drawing tool, and auto-fill the sqft field that drives the estimate. The feature is additive — it does not replace manual sqft entry but provides a better path for users who do not know their roof size. The existing 3-step widget flow is unchanged in structure; all new UI lives inside the existing RoofDetails step.

The recommended approach is tight integration with the current Google Maps Platform APIs. Two hard API constraints define the implementation: (1) `google.maps.places.AutocompleteSuggestion` must be used for address autocomplete — the legacy `Autocomplete` class is blocked for new API keys since March 1, 2025; (2) Terra Draw must be used for polygon drawing — Google's `DrawingManager` is deprecated August 2025 and removed May 2026. Building on either deprecated path today means a forced rewrite before the feature matures. The Google Maps JS API itself must load at runtime via a CDN script tag, never bundled, and must activate lazily only when the user toggles into map mode to protect the widget's bundle size constraint.

The primary technical risks center on Shadow DOM interactions and Google API cost management. The widget's closed Shadow DOM creates specific integration challenges: the autocomplete dropdown must be rendered as a `document.body` portal, and `PlaceAutocompleteElement` (Google's new web component) must be avoided entirely in favor of the programmatic `AutocompleteSuggestion` API — nested closed Shadow DOMs make CSS styling impossible and break dropdown positioning. API costs are manageable at normal roofing company volumes (the entire flow costs ~$0.01-0.02 per map-mode user), but autocomplete session tokens must be implemented correctly from day one to avoid 5-10x cost overruns.

## Key Findings

### Recommended Stack

The v1.0 stack (Preact, @preact/signals, Vite, TypeScript, Hono, Drizzle, Cloudflare Workers/D1/R2) is locked and validated. The v1.1 additions load at runtime where possible to preserve the 28KB IIFE constraint.

**Core technologies added for v1.1:**
- `@googlemaps/js-api-loader` (v2.0.2): Official Google loader for the Maps JS API — handles deduplication and the `importLibrary()` async pattern. ~4KB gzipped, bundled into the IIFE. The Maps API itself loads from Google's CDN at runtime, not bundled.
- `terra-draw` (v1.25.0) + `terra-draw-google-maps-adapter` (v1.3.1): Google's documented replacement for the deprecated Drawing Library. Provides polygon mode, GeoJSON output, touch support. Must be loaded via CDN script injection at map-step activation due to the Vite IIFE `inlineDynamicImports: true` constraint — bundling Terra Draw's 3.9MB unpacked size would destroy the bundle size constraint.
- `@turf/area` (sub-package only): Spherical polygon area calculation. ~8KB, bundled into IIFE. Correctly handles WGS84 lat/lng coordinate math; naive planar Shoelace formula produces measurable error on spherical coordinates.
- `google.maps.places.AutocompleteSuggestion`: Programmatic address autocomplete via the Places Autocomplete Data API. Available to new API keys; the legacy `Autocomplete` class is blocked since March 1, 2025.
- `@types/google.maps`: Dev-only TypeScript types. Zero runtime cost.

**Critical build note:** The existing Vite IIFE config uses `inlineDynamicImports: true`, which prevents true code splitting. Terra Draw must be loaded via CDN script injection at map-step activation rather than via Vite dynamic import.

### Expected Features

All P1 features scope entirely within the existing RoofDetails step. No new steps are added (4-step maximum is a hard constraint). The feature is opt-in via a mode toggle — the v1.0 experience is the default.

**Must have (table stakes for v1.1):**
- "Measure on map" / "Enter manually" toggle — map mode is opt-in, preserving v1.0 as the default
- Address autocomplete using `AutocompleteSuggestion` — custom-styled input inside Shadow DOM, dropdown as `document.body` portal
- Satellite (hybrid) map panel — lazy-loaded on toggle activation; `mapTypeId: 'hybrid'` so street labels help homeowners confirm the right property
- Polygon drawing via Terra Draw `TerraDrawPolygonMode` — click-to-place vertices, GeoJSON output
- Real-time sqft display as vertices are placed — `draw.on('change')` → `computeArea()` → signal update
- "Done Drawing" button to close polygon programmatically — critical for mobile where tapping the first vertex precisely is nearly impossible
- Undo last point or "Clear and restart" button
- Auto-fill `formData.sqft` on polygon completion, pitch-adjusted if pitch is already selected
- Pitch-adjustment notification ("Roof surface at [pitch] pitch: X sqft")
- `formData.address` populated from autocomplete, included in lead email

**Should have (v1.2, trigger-based):**
- Pitch recalculation when pitch changes after measurement is complete
- "My location" geolocation button (trigger: mobile friction data)
- Map confirmation thumbnail in estimate display step (trigger: user feedback)

**Defer (v2+):**
- Multi-polygon for complex roofs (dormers, additions) — UX complexity exceeds the widget's simplicity constraint
- AI-assisted roof detection — requires expensive third-party APIs ($10-25/report) incompatible with a free embedded widget
- Saved address/measurement for return visits

**Anti-features to avoid:**
- `google.maps.drawing.DrawingManager` — deprecated August 2025, removed May 2026
- `google.maps.places.Autocomplete` or `AutocompleteService` — blocked for new API keys since March 1, 2025
- `PlaceAutocompleteElement` inside Shadow DOM — nested closed Shadow DOM creates unsolvable CSS and dropdown positioning conflicts
- Storing polygon GeoJSON in the database — no downstream use in v1; extract sqft client-side and discard the polygon
- Satellite-only map type (no labels) — homeowners cannot confirm property identity without street labels
- Forcing map measurement — manual sqft entry must remain a full peer path, not a buried fallback link

### Architecture Approach

The new components slot into the existing widget as sub-steps within `RoofDetails`, orchestrated by an internal step counter. All new state is added as signals in `form.ts`. The Google Maps JS API key is delivered via the existing `/api/config/:companyId` endpoint — no new network round-trip. The Maps API bootstraps via a runtime `<script>` appended to `document.head`; `importLibrary()` handles per-library lazy loading. Terra Draw is initialized only when the map step mounts, using CDN script injection to avoid bundle size impact.

**Major components:**
1. `utils/mapsLoader.ts` — singleton Maps API bootstrap with deduplication, `importLibrary` wrapper. Must exist before any component work.
2. `utils/area.ts` — pure function: GeoJSON polygon → sqft, pitch multiplier lookup. Must have unit tests before component work begins. This is the most bug-prone calculation in the feature.
3. `AddressInput` — standard `<input class="rc-input">` inside Shadow DOM, `AutocompleteSuggestion` API on keystrokes, session token management, dropdown as `document.body` portal with `position: fixed`.
4. `RoofMap` — satellite Map instance rendered into a Shadow DOM div with explicit CSS height (required — `all: initial` resets div height to 0 without it). Terra Draw initialized on mount.
5. `PolygonDrawing` — draw/clear/confirm UI controls, GeoJSON polygon → `mapFootprintSqft` signal.
6. `SquareFootageConfirm` — existing sqft/pitch/material selectors, pre-filled from map calculation, user-editable.
7. API: `config.ts` + `types.ts` — `googleMapsApiKey` added to existing config response and `Bindings` type.

**Key data flow:** Address autocomplete → `mapCoords` signal → `RoofMap` mounts → Terra Draw polygon → `mapFootprintSqft` signal → pitch-adjusted sqft → `formData.sqft`. ContactInfo and EstimateDisplay read `formData.sqft` without any changes — zero regression risk to downstream steps.

### Critical Pitfalls

1. **Deprecated Drawing Library** — `google.maps.drawing.DrawingManager` is deprecated August 2025, removed May 2026. Use Terra Draw exclusively. Any `google.maps.drawing` import is a build-blocking error.

2. **Legacy Places API blocked for new API keys** — `google.maps.places.Autocomplete` and `AutocompleteService` are unavailable to new Maps Platform customers since March 1, 2025. Use `AutocompleteSuggestion` from the Places Autocomplete Data API only.

3. **PlaceAutocompleteElement + Shadow DOM conflict** — nested closed Shadow DOMs make CSS styling impossible and the `.pac-container` dropdown positions incorrectly in nested Shadow DOM context. Use the programmatic `AutocompleteSuggestion` API with a custom input and `document.body` portal instead.

4. **Autocomplete session token mismanagement causes 5-10x cost overrun** — without session tokens, each keystroke is billed individually ($2.83/1,000). With tokens, an entire address-entry interaction (all keystrokes + Place Details fetch) counts as one session event. Session tokens must be implemented on day one, not as a post-launch optimization.

5. **Google Maps eager loading bloats host page** — the Maps API adds ~400KB to page load weight. Load lazily: bootstrap only when the user activates "Measure on map" toggle. Use `loading=async` on the bootstrap script. Never include the Maps API URL in the widget's initial bundle.

6. **API key without restrictions** — the key will be visible in DevTools (unavoidable for browser-side Maps embeds). Apply HTTP Referrer restrictions (widget domain + customer domains) and API restrictions (Maps JS + Places New only) before the key is committed to any code.

7. **Mobile touch: pan vs. draw conflict** — single-finger touch both pans the map and places polygon vertices with no built-in reconciliation. Design an explicit Pan/Draw mode toggle with `gestureHandling: "none"` in Draw mode. Test on real touch devices, not mouse emulation.

8. **Rural satellite imagery quality** — imagery resolution degrades below zoom 19 for rural and suburban addresses outside major metros. Use `MaxZoomService` to check zoom availability at the resolved address and show a warning if imagery is insufficient. Manual entry fallback must be prominent throughout the map flow.

## Implications for Roadmap

The feature has clear sequential dependencies that determine build order. Four phases are recommended, ordered strictly by component dependency.

### Phase 1: Infrastructure and Foundation

**Rationale:** The Maps API key delivery pipeline, the singleton loader, and the pure area math are dependencies of every other component. Building them first means each subsequent component can be developed and tested in isolation. The Terra Draw CDN loading strategy must also be confirmed before implementation starts — changing loading strategy mid-build is painful.

**Delivers:**
- `GOOGLE_MAPS_API_KEY` in Cloudflare Workers environment and config response
- `utils/mapsLoader.ts` (singleton bootstrap, `importLibrary` wrapper)
- `utils/area.ts` with full unit test coverage (GeoJSON → sqft, all 4 pitch multipliers)
- New signals added to `state/form.ts` (`mapAddress`, `mapCoords`, `mapFootprintSqft`, `mapMeasurementUsed`)
- Terra Draw CDN loading strategy confirmed via proof-of-concept
- API key restricted (HTTP Referrers + API restriction) before any code is committed

**Addresses:** Infrastructure prerequisites; Pitfalls 5 (lazy loading), 6 (key restrictions), 7 (no DrawingManager), 8 (correct API surface)

**Avoids:** No UI work before foundation is solid; no deprecated APIs touch the codebase

### Phase 2: Address Autocomplete and Map Display

**Rationale:** `AddressInput` produces the `mapCoords` signal that `RoofMap` depends on. Both must be complete and tested before polygon drawing can be meaningfully exercised end-to-end.

**Delivers:**
- `AddressInput` component with `AutocompleteSuggestion`, session token management, `document.body` portal dropdown, US address restriction
- `RoofMap` component: hybrid satellite map, lazy Maps API bootstrap, correct Shadow DOM container height (explicit CSS height — required)
- Integration: address selection → `mapCoords` signal → map centers at zoom 19
- Mobile layout: 220px map height on mobile, 320px on desktop

**Addresses:** Table stakes features (address autocomplete, satellite map display); Pitfalls 3 (no PlaceAutocompleteElement), 4 (session tokens), 8 (new Places API)

**Avoids:** `PlaceAutocompleteElement` entirely; all legacy autocomplete APIs

### Phase 3: Polygon Drawing and sqft Auto-fill

**Rationale:** Depends on a working Map instance from Phase 2. Terra Draw initialization wraps the `google.maps.Map` object directly. The area calculation utility is already unit-tested (Phase 1), so this phase is UI wiring and mobile UX hardening.

**Delivers:**
- `PolygonDrawing` component: Terra Draw polygon mode, real-time sqft display, "Done Drawing" button, undo/clear controls, Pan/Draw mode toggle for mobile
- `MaxZoomService` check at address resolution with user warning for low-resolution imagery
- `SquareFootageConfirm`: pre-filled sqft (editable), pitch-adjusted calculation with notification
- `RoofDetails` orchestration: sub-step A/B/C state machine, "Enter manually" / "Measure on map" toggle
- Fallback path verification: skip map → manual sqft entry works identically to v1.0

**Addresses:** All remaining P1 features; Pitfalls 7 (Terra Draw not DrawingManager), 9 (mobile touch), 10 (rural imagery warning)

**Avoids:** Any regression to ContactInfo, EstimateDisplay, or the estimate API call

### Phase 4: Lead Email Integration

**Rationale:** Small, bounded scope. The address field needs to propagate to the API POST body and the Resend lead email template. No UI changes required.

**Delivers:**
- `formData.address` field in POST body Zod schema (optional string, validated)
- Address line in Resend lead email template
- End-to-end smoke test: address → polygon → estimate → lead email includes address

**Addresses:** "Address in lead email" differentiator feature

**Avoids:** Over-engineering — this is a 2-field schema change, not a migration event

### Phase Ordering Rationale

- Phase 1 is prerequisite to everything — loader and area math underpin all components
- Phase 2 is prerequisite to Phase 3 — the Map instance must exist before Terra Draw can initialize
- Phase 3 closes the core user flow — after this phase the feature is shippable
- Phase 4 is independently deliverable after Phase 2 (address signal is available then) but poses the lowest risk and can be last without blocking release
- The manual sqft fallback path must be regression-tested at the end of Phase 3 before shipping

### Research Flags

Phases with standard, well-documented patterns (skip research-phase):
- **Phase 1:** Cloudflare Workers environment variables and config endpoint extension are established patterns already implemented in this codebase.
- **Phase 4:** Resend email template extension is a direct repeat of v1.0 lead email work.

Phases that may benefit from targeted investigation during planning:
- **Phase 2:** The `document.body` portal positioning for the autocomplete dropdown needs validation against real host-site scroll containers and fixed-position stacking contexts. The pattern is architecturally sound but untested in this specific codebase.
- **Phase 3:** Terra Draw CDN loading inside the Vite IIFE needs a working proof-of-concept before Phase 3 planning commits to the approach. The `inlineDynamicImports: true` Vite config creates an unusual loading constraint that may require a build config change.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All critical claims verified against official Google documentation. Deprecation timelines confirmed from official Google deprecation page. Library versions confirmed from npm registry and GitHub releases. |
| Features | HIGH | Official Google docs verified March 2026. Existing codebase inspected for integration points. Feature scope is conservative and bounded by the existing widget's hard constraints. |
| Architecture | HIGH | All patterns verified against official Google documentation and confirmed working in analogous implementations. Shadow DOM + Google Maps pattern confirmed via Google's own web components academy. |
| Pitfalls | HIGH | Critical pitfalls are based on official deprecation notices and Google billing documentation. Shadow DOM interaction pitfalls confirmed by practitioner community. Mobile interaction pitfalls confirmed by pattern analysis. |

**Overall confidence:** HIGH

### Gaps to Address

- **Pitch multiplier value discrepancy:** ARCHITECTURE.md uses {flat: 1.00, low: 1.07, medium: 1.18, steep: 1.36}. FEATURES.md uses {flat: 1.00, low: 1.05, medium: 1.12, steep: 1.25}. These differ. The correct values must be confirmed against the existing pricing engine in `packages/api` before `utils/area.ts` is written — this is the core calculation.

- **Terra Draw CDN loading proof-of-concept:** The `inlineDynamicImports: true` Vite config is an unusual constraint. Before Phase 3 planning, build a minimal proof-of-concept confirming CDN script injection works in the IIFE context and that the Terra Draw API is accessible after load. If it does not work cleanly, evaluate changing the Vite build config to allow code splitting for the map step.

- **`MaxZoomService` integration scope:** PITFALLS.md recommends checking zoom availability at the resolved address to handle rural imagery degradation, but this is not included in the ARCHITECTURE.md build order. It should be explicitly added to Phase 3 implementation scope during planning.

- **Per-company vs. shared API key:** The current design uses a single shared `GOOGLE_MAPS_API_KEY` environment variable with HTTP Referrer restrictions. If multi-tenancy with per-company billing becomes a requirement, a D1 column on the `companies` table is needed. Flagged as a future consideration; not in scope for v1.1.

## Sources

### Primary (HIGH confidence)
- [Google Maps Deprecations page](https://developers.google.com/maps/deprecations) — DrawingManager deprecated August 2025, removed May 2026; legacy Autocomplete blocked March 1, 2025
- [Terra Draw on Google Maps (Official Example)](https://developers.google.com/maps/documentation/javascript/examples/map-drawing-terradraw) — Google's documented replacement for DrawingManager
- [Place Autocomplete Data API docs](https://developers.google.com/maps/documentation/javascript/place-autocomplete-data) — `AutocompleteSuggestion`, session tokens
- [Place Autocomplete Widget docs](https://developers.google.com/maps/documentation/javascript/place-autocomplete-new) — `PlaceAutocompleteElement` closed Shadow DOM behavior
- [Load the Maps JavaScript API — Dynamic Library Import](https://developers.google.com/maps/documentation/javascript/load-maps-js-api) — `importLibrary()` pattern, `loading=async`
- [Google Maps Platform Security Guidance](https://developers.google.com/maps/api-security-best-practices) — HTTP Referrer + API key restrictions
- [Google Maps Billing Pricing page](https://developers.google.com/maps/billing-and-pricing/pricing) — March 2025 per-SKU free thresholds
- [Google Maps March 2025 pricing changes](https://developers.google.com/maps/billing-and-pricing/march-2025) — $200 credit replaced with free usage tiers
- [Geometry Library reference](https://developers.google.com/maps/documentation/javascript/reference/geometry) — `spherical.computeArea()`, `importLibrary("geometry")`
- [@googlemaps/js-api-loader GitHub releases](https://github.com/googlemaps/js-api-loader/releases) — v2.0.2, October 2025
- [terra-draw npm registry](https://www.npmjs.com/package/terra-draw) — v1.25.0
- [Drawing Layer Deprecation Notice](https://developers.google.com/maps/documentation/javascript/drawinglayer) — August 2025 deprecation, May 2026 removal
- [Autocomplete session pricing](https://developers.google.com/maps/documentation/javascript/session-pricing) — session-based billing model

### Secondary (MEDIUM confidence)
- [Mastering Google Places new API — Shadow DOM styling](https://juancrg90.me/posts/mastering-google-places-new-api/) — closed Shadow DOM monkey-patch workaround and why to avoid it
- [Bitovi web components academy — Map View](https://bitovi.github.io/academy/learn-web-components/map-view.html) — rendering Google Maps inside Shadow DOM via div reference
- [Drawing Library Deprecation Discussion — react-google-maps](https://github.com/visgl/react-google-maps/discussions/825) — community corroboration of official deprecation
- [Places Autocomplete not available to new customers](https://github.com/visgl/react-google-maps/issues/736) — community corroboration of March 2025 migration
- [Mapscaping free roof area calculator](https://mapscaping.com/free-interactive-roof-area-calculator/) — UX reference for address → satellite → polygon → area flow
- [1ESX: How to Measure a Roof from Satellite 2026](https://www.1esx.com/how-to-measure-a-roof-from-a-satellite-for-free-a-2026-guide/) — typical polygon tool UX patterns

---
*Research completed: 2026-03-10*
*Ready for roadmap: yes*
