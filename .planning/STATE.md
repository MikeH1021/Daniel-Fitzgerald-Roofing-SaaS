---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Google Maps Roof Measurement
status: in_progress
stopped_at: Completed 05-02-PLAN.md
last_updated: "2026-03-11"
last_activity: 2026-03-11 — Completed 05-02 (AddressAutocomplete, MapView, MapStep, App map mode integration)
progress:
  total_phases: 3
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
  percent: 33
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-10)

**Core value:** Homeowners get an instant, credible roof estimate — and the roofing company captures a qualified lead with contact info and project details.
**Current focus:** Phase 5 — Map Infrastructure + Address Autocomplete

## Current Position

Phase: 5 of 7 (Map Infrastructure + Address Autocomplete) — COMPLETE
Plan: 2 of 2 complete in current phase
Status: Phase 5 complete, ready for Phase 6 planning
Last activity: 2026-03-11 — Completed 05-02 (AddressAutocomplete portal dropdown, MapView satellite map, MapStep lazy orchestrator, App map mode toggle)

Progress: [███░░░░░░░] 33%

## Performance Metrics

**Velocity (v1.0 baseline):**
- Total plans completed: 7 (v1.0)
- Average duration: ~4 min/plan
- Total execution time: ~26 min

**By Phase (v1.0):**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. API + Estimate Engine | 2 | ~8 min | ~4 min |
| 2. Embeddable Widget | 2 | ~8 min | ~4 min |
| 3. Lead Delivery | 1 | ~4 min | ~4 min |
| 4. Admin Settings | 2 | ~6 min | ~3 min |

**v1.1 in progress:**

| Phase | Plan | Duration | Tasks | Files |
|-------|------|----------|-------|-------|
| 05 | 01 | 3 min | 2 | 10 |
| 05 | 02 | deferred* | 1+1 | 6 |

*\* Plan 02 human verification deferred pending Google Maps API key*

*Running avg: ~3 min/plan (auto tasks)*

## Accumulated Context

### Decisions

Full decision log in PROJECT.md Key Decisions table.

Recent decisions affecting v1.1:
- Use `AutocompleteSuggestion` API (not legacy `Autocomplete` — blocked for new API keys since March 2025)
- Use Terra Draw for polygon drawing (not `DrawingManager` — deprecated August 2025, removed May 2026)
- Load Google Maps JS API lazily via CDN, not bundled (preserves 28KB widget size constraint)
- Load Terra Draw via CDN script injection at map-step activation (Vite `inlineDynamicImports: true` prevents code splitting)
- Single shared `GOOGLE_MAPS_API_KEY` with HTTP Referrer restrictions (per-company keys deferred to v2)
- Autocomplete dropdown rendered as `document.body` portal (Shadow DOM prevents nested dropdown positioning)
- Do not store polygon GeoJSON in database — extract sqft client-side and discard geometry

### Pending Todos

None.

### Blockers/Concerns

- Pitch multiplier value discrepancy: ARCHITECTURE.md vs FEATURES.md use different values. Confirm against existing `packages/api` pricing engine before writing `utils/area.ts`.
- Terra Draw CDN loading proof-of-concept needed before Phase 6 planning — `inlineDynamicImports: true` Vite config is an unusual constraint.
- Autocomplete session tokens must be implemented from day one (5-10x cost overrun without them). ✅ RESOLVED in 05-01.
- Pitch multiplier value discrepancy: ARCHITECTURE.md vs FEATURES.md use different values. Confirm against existing `packages/api` pricing engine before writing `utils/area.ts`.
- Terra Draw CDN loading proof-of-concept needed before Phase 6 planning — `inlineDynamicImports: true` Vite config is an unusual constraint.

### 05-01 Decisions
- No `includedPrimaryTypes` filter on AutocompleteSuggestion — broader results recommended (add filtering in Phase 6 if noise observed)
- Inline script resolve() called after appendChild (not onload) — textContent scripts execute synchronously
- Session token reset only after resolvePlaceLocation completes fetchFields (ends billing session correctly)

### 05-02 Decisions
- Portal renders into document.body with inline styles — Shadow DOM boundary prevents CSS classes from reaching portaled content
- onMouseDown preventDefault on suggestion items prevents blur-before-click (RESEARCH.md Pitfall 5)
- mapMode signal is the sole lazy-loading gate — no Maps API calls until homeowner explicitly activates map mode (MAP-03)
- MapView stores map instance in useRef, calls setCenter() on lat/lng change instead of re-creating map

## Session Continuity

Last session: 2026-03-11
Stopped at: Completed 05-02-PLAN.md (Phase 5 complete — human verification deferred pending API key)
Resume file: None
