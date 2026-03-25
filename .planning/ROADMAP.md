# Roadmap: Roofing Estimate Calculator

## Milestones

- ✅ **v1.0 MVP** — Phases 1-4 (shipped 2026-03-10)
- ✅ **v1.1 Google Maps Roof Measurement** — Phases 5-7 (shipped 2026-03-16)
- 📋 **v2.0 Admin Platform & Lead Management** — Phases 8-10 (planned)

## Phases

<details>
<summary>✅ v1.0 MVP (Phases 1-4) — SHIPPED 2026-03-10</summary>

- [x] Phase 1: API + Estimate Engine (2/2 plans) — completed 2026-03-09
- [x] Phase 2: Embeddable Widget (2/2 plans) — completed 2026-03-09
- [x] Phase 3: Lead Delivery (1/1 plan) — completed 2026-03-10
- [x] Phase 4: Admin Settings (2/2 plans) — completed 2026-03-10

</details>

<details>
<summary>✅ v1.1 Google Maps Roof Measurement (Phases 5-7) — SHIPPED 2026-03-16</summary>

- [x] Phase 5: Map Infrastructure + Address Autocomplete (2/2 plans) — completed 2026-03-11
- [x] Phase 6: Polygon Drawing + sqft Auto-fill + UX (2/2 plans) — completed 2026-03-16
- [x] Phase 7: Lead Email Integration (1/1 plan) — completed 2026-03-16

</details>

### 📋 v2.0 Admin Platform & Lead Management (Planned)

**Milestone Goal:** Transform the admin from a settings panel into a full platform — lead management, RBAC, analytics, security hardening, and widget UX improvements.

- [x] **Phase 8: Security Foundation & Tech Debt** — RBAC, auth hardening, legacy cleanup, and DB performance groundwork (completed 2026-03-25)
- [ ] **Phase 9: Lead Management & Analytics** — Lead list, CSV export, estimate delivery to customer, and per-company stats
- [ ] **Phase 10: Admin & Widget Polish** — Company archiving, live branding preview, pricing validation, and widget UX fixes

## Phase Details

### Phase 8: Security Foundation & Tech Debt
**Goal**: The platform has correct access controls, hardened authentication, and a clean codebase with performant queries
**Depends on**: Phase 7 (v1.1 complete)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, DEBT-01, DEBT-02, DEBT-03
**Success Criteria** (what must be TRUE):
  1. A super-admin user can view and manage all companies; a company-admin user can only see and modify their own company
  2. The login endpoint rejects repeated failed attempts (rate limiting), preventing brute force attacks
  3. When a session expires, the user is automatically redirected to the login page instead of seeing a silent error
  4. Legacy session-scoped admin routes (/admin/settings, /admin/pricing, /admin/logo) return 404 or redirect, with no broken functionality
  5. Leads and companies list queries complete without full-table scans (indexes on leads.companyId, leads.createdAt; endpoints return paginated responses)
**Plans:** 2/2 plans complete
Plans:
- [x] 08-01-PLAN.md — RBAC roles, login rate limiting, CSRF protection, and session expiry redirect
- [x] 08-02-PLAN.md — Legacy route removal, DB indexes, and paginated list endpoints

### Phase 9: Lead Management & Analytics
**Goal**: Admins can view, search, export, and understand their leads; homeowners receive a copy of their estimate
**Depends on**: Phase 8
**Requirements**: LEAD-01, LEAD-02, LEAD-03, STATS-01
**Success Criteria** (what must be TRUE):
  1. Admin can view a paginated list of leads for their company, searchable by name/email and filterable by date range
  2. Admin can download a CSV file of their leads with all relevant fields included
  3. After submitting the estimate form, the homeowner receives an email (or PDF) with their estimate details
  4. Admin sees a dashboard panel showing total estimates, total leads, popular materials, and average sqft for their company
**Plans:** 2 plans
Plans:
- [ ] 09-01-PLAN.md — API: leads search/filter, CSV export, stats endpoint, customer estimate email
- [ ] 09-02-PLAN.md — Admin UI: lead list page, stats dashboard panel, new tabs on company edit

### Phase 10: Admin & Widget Polish
**Goal**: Admins have a complete, reliable editing experience and the widget provides clear feedback and smooth navigation
**Depends on**: Phase 9
**Requirements**: COMP-01, COMP-02, PRICE-01, WID-01, WID-02
**Success Criteria** (what must be TRUE):
  1. Admin can archive a company — it disappears from the active list but all data is preserved and recoverable
  2. In the branding editor, the widget preview updates in real time as the admin changes logo or color, without saving first
  3. Pricing form rejects inputs where cost_low >= cost_high, any negative values, or values outside sensible ranges, with clear error messages
  4. A homeowner who reaches the estimate screen can click back to edit roof details and their contact info is still filled in when they return
  5. When the API returns a rate limit or validation error, the widget displays a specific, human-readable message instead of a generic failure
**Plans**: TBD

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. API + Estimate Engine | v1.0 | 2/2 | Complete | 2026-03-09 |
| 2. Embeddable Widget | v1.0 | 2/2 | Complete | 2026-03-09 |
| 3. Lead Delivery | v1.0 | 1/1 | Complete | 2026-03-10 |
| 4. Admin Settings | v1.0 | 2/2 | Complete | 2026-03-10 |
| 5. Map Infrastructure + Address Autocomplete | v1.1 | 2/2 | Complete | 2026-03-11 |
| 6. Polygon Drawing + sqft Auto-fill + UX | v1.1 | 2/2 | Complete | 2026-03-16 |
| 7. Lead Email Integration | v1.1 | 1/1 | Complete | 2026-03-16 |
| 8. Security Foundation & Tech Debt | v2.0 | 2/2 | Complete | 2026-03-25 |
| 9. Lead Management & Analytics | v2.0 | 0/2 | Not started | - |
| 10. Admin & Widget Polish | v2.0 | 0/? | Not started | - |
