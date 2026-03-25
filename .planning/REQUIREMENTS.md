# Requirements: Roofing Estimate Calculator

**Defined:** 2026-03-24
**Core Value:** Homeowners get an instant, credible roof estimate — and the roofing company captures a qualified lead with contact info and project details.

## v2.0 Requirements

Requirements for v2.0 Admin Platform & Lead Management. Each maps to roadmap phases.

### Lead Management

- [ ] **LEAD-01**: Admin can view list of leads per company with search and date filtering
- [ ] **LEAD-02**: Admin can export leads as CSV per company
- [ ] **LEAD-03**: Customer receives PDF or email copy of their estimate after submission

### Auth & Security

- [x] **AUTH-01**: Super-admin role can manage all companies; company-admin role can only access their own company
- [x] **AUTH-02**: Login endpoint is rate-limited to prevent brute force attacks
- [x] **AUTH-03**: Session expiry triggers automatic redirect to login instead of silent 401 errors
- [x] **AUTH-04**: CSRF protection on all state-changing form submissions

### Company Management

- [ ] **COMP-01**: Admin can soft-delete/archive a company (hides from list, preserves data)
- [ ] **COMP-02**: Admin sees live widget preview in branding editor that updates as settings change

### Pricing

- [ ] **PRICE-01**: Pricing inputs validate that cost_low < cost_high, no negatives, and values are within sensible ranges

### Analytics

- [ ] **STATS-01**: Admin sees per-company dashboard with total estimates, total leads, popular materials, and average sqft

### Widget UX

- [ ] **WID-01**: User can go back and edit roof details after viewing estimate without re-entering contact info
- [ ] **WID-02**: Widget shows specific error messages from API (rate limit, validation errors) instead of generic failure text

### Tech Debt

- [x] **DEBT-01**: Remove legacy session-scoped admin routes (/admin/settings, /admin/pricing, /admin/logo)
- [x] **DEBT-02**: Add database indexes on leads.companyId and leads.createdAt for query performance
- [x] **DEBT-03**: Pagination on leads list and companies list API endpoints

## Future Requirements

Deferred to v2.1+. Tracked but not in current roadmap.

### Notifications
- **NOTIF-01**: Companies can configure multiple notification email recipients
- **NOTIF-02**: Companies can customize consent checkbox text

### Integrations
- **INTG-01**: Webhook support for lead notifications
- **INTG-02**: CRM integration (HubSpot, Pipedrive)

### Auth
- **AUTH-05**: Password reset flow via email link

## Out of Scope

| Feature | Reason |
|---------|--------|
| SMS/text notifications | Email sufficient for v2.0 |
| Real-time analytics / charts | Simple counters sufficient; charting library overhead not justified |
| Multi-factor authentication | Email/password + rate limiting sufficient for target market |
| OAuth / social login | Not needed for admin tool |
| Stripe billing integration | Handle offline for now |
| Mobile app | Web-first approach |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| LEAD-01 | Phase 9 | Pending |
| LEAD-02 | Phase 9 | Pending |
| LEAD-03 | Phase 9 | Pending |
| AUTH-01 | Phase 8 | Complete |
| AUTH-02 | Phase 8 | Complete |
| AUTH-03 | Phase 8 | Complete |
| AUTH-04 | Phase 8 | Complete |
| COMP-01 | Phase 10 | Pending |
| COMP-02 | Phase 10 | Pending |
| PRICE-01 | Phase 10 | Pending |
| STATS-01 | Phase 9 | Pending |
| WID-01 | Phase 10 | Pending |
| WID-02 | Phase 10 | Pending |
| DEBT-01 | Phase 8 | Complete |
| DEBT-02 | Phase 8 | Complete |
| DEBT-03 | Phase 8 | Complete |

**Coverage:**
- v2.0 requirements: 16 total
- Mapped to phases: 16
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-24*
*Last updated: 2026-03-24 — traceability populated after roadmap creation*
