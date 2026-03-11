# Roadmap: Roofing Estimate Calculator

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-10)
- 🚧 **v1.1 Google Maps Roof Measurement** — Phases 5-7 (in progress)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-10</summary>

- [x] Phase 1: API + Estimate Engine (2/2 plans) — completed 2026-03-09
- [x] Phase 2: Embeddable Widget (2/2 plans) — completed 2026-03-09
- [x] Phase 3: Lead Delivery (1/1 plan) — completed 2026-03-10
- [x] Phase 4: Admin Settings (2/2 plans) — completed 2026-03-10

</details>

### 🚧 v1.1 Google Maps Roof Measurement (In Progress)

**Milestone Goal:** Let homeowners who don't know their roof sqft draw their roof on a satellite map and get an auto-calculated, pitch-adjusted square footage — without breaking the existing manual entry path.

- [x] **Phase 5: Map Infrastructure + Address Autocomplete** - API key delivery, lazy loader, area math utilities, and address search with satellite map display
- [ ] **Phase 6: Polygon Drawing + sqft Auto-fill + UX** - Roof polygon tracing on satellite map, auto-fill of sqft field, mobile controls, and mode toggle
- [ ] **Phase 7: Lead Email Integration** - Property address captured from map propagates to lead notification email

## Phase Details

### Phase 5: Map Infrastructure + Address Autocomplete
**Goal**: The widget can securely deliver a Google Maps API key to the browser, lazily bootstrap the Maps JS API, and let a homeowner search for their address and see a satellite view of their property
**Depends on**: Phase 4 (v1.0 complete)
**Requirements**: MAP-01, MAP-02, MAP-03
**Success Criteria** (what must be TRUE):
  1. Homeowner can type a partial address and see autocomplete suggestions appear below the input
  2. Selecting an address suggestion centers a satellite/hybrid map on that property at roof-level zoom
  3. The Google Maps JS API does not load (no network request) until the homeowner activates map mode
  4. The widget bundle size is not meaningfully increased by the map infrastructure code
**Plans**: 2 plans

Plans:
- [x] 05-01-PLAN.md — API key endpoint, lazy CDN loader, autocomplete data layer, map state signals
- [x] 05-02-PLAN.md — AddressAutocomplete + MapView components, App integration, visual verification

### Phase 6: Polygon Drawing + sqft Auto-fill + UX
**Goal**: A homeowner can trace their roof outline on the satellite map, see the pitch-adjusted square footage calculated in real time, and have it auto-fill the sqft field — with a seamless fallback to manual entry throughout
**Depends on**: Phase 5
**Requirements**: MEAS-01, MEAS-02, MEAS-03, MEAS-04, MEAS-05, UX-01, UX-02
**Success Criteria** (what must be TRUE):
  1. Homeowner can click/tap vertices on the map to trace their roof outline and see live sqft update as each point is placed
  2. Tapping "Done Drawing" closes the polygon and auto-fills the sqft field with the pitch-adjusted measurement
  3. Homeowner can undo the last placed point or clear the polygon entirely and redraw
  4. Homeowner can switch between "Enter manually" and "Measure on map" modes at any time — manual entry remains fully functional as the default
  5. When the Maps API is blocked by the host site's CSP, the widget falls back gracefully to manual sqft entry with no broken UI
**Plans**: TBD

Plans:
- [ ] 06-01: TBD

### Phase 7: Lead Email Integration
**Goal**: The roofing company's lead notification email includes the property address whenever a homeowner used map mode, giving the company the address without having to ask for it separately
**Depends on**: Phase 5
**Requirements**: LEAD-01
**Success Criteria** (what must be TRUE):
  1. When a homeowner selects an address via map mode, the roofing company's lead email includes the property address
  2. When a homeowner uses manual sqft entry (no address entered), the lead email is unchanged from v1.0
**Plans**: TBD

Plans:
- [ ] 07-01: TBD

## Progress

**Execution Order:** 5 → 6 → 7

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. API + Estimate Engine | v1.0 | 2/2 | Complete | 2026-03-09 |
| 2. Embeddable Widget | v1.0 | 2/2 | Complete | 2026-03-09 |
| 3. Lead Delivery | v1.0 | 1/1 | Complete | 2026-03-10 |
| 4. Admin Settings | v1.0 | 2/2 | Complete | 2026-03-10 |
| 5. Map Infrastructure + Address Autocomplete | 2/2 | Complete   | 2026-03-11 | 2026-03-11 |
| 6. Polygon Drawing + sqft Auto-fill + UX | v1.1 | 0/? | Not started | - |
| 7. Lead Email Integration | v1.1 | 0/? | Not started | - |
