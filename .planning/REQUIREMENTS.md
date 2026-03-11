# Requirements: Roofing Estimate Calculator

**Defined:** 2026-03-10
**Core Value:** Homeowners get an instant, credible roof estimate — and the roofing company captures a qualified lead with contact info and project details.

## v1.1 Requirements

Requirements for Google Maps Roof Measurement milestone. Each maps to roadmap phases.

### Map Infrastructure

- [x] **MAP-01**: User can type an address and see autocomplete suggestions
- [ ] **MAP-02**: Map displays satellite/hybrid view centered on selected address at roof-level zoom
- [x] **MAP-03**: Google Maps API loads lazily only when user activates map mode

### Measurement

- [ ] **MEAS-01**: User can draw polygon vertices around roof outline on satellite map
- [ ] **MEAS-02**: Widget calculates footprint area from polygon and adjusts for selected pitch
- [ ] **MEAS-03**: Calculated sqft auto-fills the existing sqft field
- [ ] **MEAS-04**: User can tap "Done Drawing" to close polygon (mobile-friendly)
- [ ] **MEAS-05**: User can undo last point or clear and restart the polygon

### UX

- [ ] **UX-01**: User can toggle between "Enter manually" (default) and "Measure on map" modes
- [ ] **UX-02**: Widget gracefully degrades to manual entry if Maps API is blocked by host site CSP

### Lead Data

- [ ] **LEAD-01**: Property address from autocomplete is included in lead notification email

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Measurement

- **MEAS-06**: Pitch recalculation when pitch changes after measurement
- **MEAS-07**: "My location" geolocation button for mobile address entry
- **MEAS-08**: Map confirmation thumbnail in the estimate display step

### Advanced Measurement

- **MEAS-09**: Multi-polygon for complex roofs (dormers, additions)
- **MEAS-10**: Saved address/measurement for return visits
- **MEAS-11**: AI-assisted polygon snapping to roof edges

## Out of Scope

| Feature | Reason |
|---------|--------|
| AI/ML automatic roof detection | Requires server-side image processing or expensive APIs ($10-25/address); different cost model |
| Exact pitch detection from satellite | 2D imagery cannot determine pitch; requires elevation data or stereo imagery |
| Multiple roof sections/facets | Blows up 4-step max constraint; single polygon covers 90% of residential roofs |
| Storing polygon GeoJSON in database | No downstream use for geometry; sqft number is all that matters; D1 write limits |
| Per-company Google Maps API keys | Over-complex for v1.1; single SaaS-managed key with referrer restrictions |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| MAP-01 | Phase 5 | Complete |
| MAP-02 | Phase 5 | Pending |
| MAP-03 | Phase 5 | Complete |
| MEAS-01 | Phase 6 | Pending |
| MEAS-02 | Phase 6 | Pending |
| MEAS-03 | Phase 6 | Pending |
| MEAS-04 | Phase 6 | Pending |
| MEAS-05 | Phase 6 | Pending |
| UX-01 | Phase 6 | Pending |
| UX-02 | Phase 6 | Pending |
| LEAD-01 | Phase 7 | Pending |

**Coverage:**
- v1.1 requirements: 11 total
- Mapped to phases: 11
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-10*
*Last updated: 2026-03-10 — traceability updated after roadmap creation*
