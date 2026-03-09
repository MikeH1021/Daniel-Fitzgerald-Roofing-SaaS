# Requirements: Roofing Estimate Calculator

**Defined:** 2026-03-09
**Core Value:** Homeowners get an instant, credible roof estimate — and the roofing company captures a qualified lead with contact info and project details.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Estimate Engine

- [ ] **EST-01**: Homeowner can enter roof square footage (validated, 100-10,000 sqft range)
- [ ] **EST-02**: Homeowner can select roof pitch (Flat, Low, Medium, Steep)
- [ ] **EST-03**: Homeowner can select material type (3-tab shingles, architectural shingles, standing seam metal)
- [ ] **EST-04**: Homeowner sees an estimated price range (e.g., "$8,900 - $12,800") after submitting
- [ ] **EST-05**: Price calculated using formula: sqft × pitch_multiplier × complexity_multiplier × material_cost_per_sqft
- [ ] **EST-06**: Estimates rounded to nearest $100 with "estimate only" disclaimer

### Lead Capture

- [ ] **LEAD-01**: Homeowner can enter first name, last name, email, and phone number
- [ ] **LEAD-02**: Homeowner must check TCPA-compliant consent checkbox (unchecked by default, names the company) before submitting
- [ ] **LEAD-03**: Roofing company receives email with all lead details and estimate shown within 1 minute of submission

### Widget & Embed

- [ ] **WIDG-01**: Widget embeddable via single script tag with company ID attribute
- [ ] **WIDG-02**: Widget renders inside Shadow DOM for CSS isolation from host site
- [ ] **WIDG-03**: Widget is fully responsive and usable on mobile devices
- [ ] **WIDG-04**: Widget displays company logo and primary brand color
- [ ] **WIDG-05**: Widget follows multi-step flow: roof details → contact info → estimate display

### Admin Settings

- [ ] **ADMN-01**: Company can upload logo image
- [ ] **ADMN-02**: Company can set primary brand color
- [ ] **ADMN-03**: Company can override default material costs and multipliers
- [ ] **ADMN-04**: Company can view and copy their embed code snippet

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Estimate Enhancements

- **EST-07**: Complexity factor selection (Simple/Ranch, Average, Complex/Multi-level)
- **EST-08**: Tear-off toggle adds ~$1.25/sqft for existing shingles
- **EST-09**: Regional cost factor auto-applied based on address/state
- **EST-10**: Estimate breakdown display showing how price was calculated
- **EST-11**: Multi-material comparison showing prices for all materials side by side

### Lead Enhancements

- **LEAD-04**: Address input for property context (not measurement)
- **LEAD-05**: Webhook/Zapier integration for CRM push
- **LEAD-06**: Lead performance tracking and analytics dashboard

### Widget Enhancements

- **WIDG-06**: QR code generation for print materials
- **WIDG-07**: Full theme control (fonts, spacing, border radius)

### Admin Enhancements

- **ADMN-05**: Lead management dashboard
- **ADMN-06**: Add/remove material types from calculator

## Out of Scope

| Feature | Reason |
|---------|--------|
| Satellite/aerial roof measurement | Multi-million dollar investment; Roofr and Instant Roofer already dominate. Manual sqft entry for v1. |
| Full CRM / lead dashboard | Scope creep; roofing companies have existing tools. Email leads for v1. |
| Payment processing / SaaS billing | Not needed to validate demand. Handle offline for v1. |
| WordPress plugin | Script embed works on any site. Plugin limits to WP only. |
| Contractor marketplace / matching | Different business model; conflicts with white-label value prop. |
| Permit cost estimation | Varies wildly by municipality; impossible to maintain. |
| Exact / guaranteed pricing | Creates liability. Always show ranges with disclaimers. |
| OAuth / social login for admin | Email/password sufficient for v1 admin. |
| SMS/text notifications to company | Email only for v1. |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| EST-01 | Phase 1 | Pending |
| EST-02 | Phase 1 | Pending |
| EST-03 | Phase 1 | Pending |
| EST-04 | Phase 1 | Pending |
| EST-05 | Phase 1 | Pending |
| EST-06 | Phase 1 | Pending |
| LEAD-01 | Phase 2 | Pending |
| LEAD-02 | Phase 2 | Pending |
| LEAD-03 | Phase 3 | Pending |
| WIDG-01 | Phase 2 | Pending |
| WIDG-02 | Phase 2 | Pending |
| WIDG-03 | Phase 2 | Pending |
| WIDG-04 | Phase 2 | Pending |
| WIDG-05 | Phase 2 | Pending |
| ADMN-01 | Phase 4 | Pending |
| ADMN-02 | Phase 4 | Pending |
| ADMN-03 | Phase 4 | Pending |
| ADMN-04 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-03-09*
*Last updated: 2026-03-09 after roadmap creation*
