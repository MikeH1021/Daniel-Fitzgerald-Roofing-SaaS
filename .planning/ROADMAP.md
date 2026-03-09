# Roadmap: Roofing Estimate Calculator

## Overview

This roadmap delivers an embeddable SaaS widget that captures roofing leads. The dependency chain drives phase order: the API and estimate engine must exist before the widget can call them, the widget must exist before email delivery matters, and the admin settings page is needed last because companies can be manually configured during early testing. Four phases take us from zero to a self-service product.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: API + Estimate Engine** - Backend API with pricing formula, database schema, and company config
- [ ] **Phase 2: Embeddable Widget** - Preact widget in Shadow DOM with multi-step form, branding, and mobile support
- [ ] **Phase 3: Lead Delivery** - Email notifications to roofing companies with bot protection and consent recording
- [ ] **Phase 4: Admin Settings** - Self-service portal for branding, pricing overrides, and embed code

## Phase Details

### Phase 1: API + Estimate Engine
**Goal**: A working API that calculates roofing estimates and stores company configurations, deployable to Cloudflare Workers
**Depends on**: Nothing (first phase)
**Requirements**: EST-01, EST-02, EST-03, EST-04, EST-05, EST-06
**Success Criteria** (what must be TRUE):
  1. API accepts roof sqft, pitch, and material type and returns a price range (min-max) rounded to nearest $100
  2. API rejects invalid inputs (sqft outside 100-10,000, missing fields) with clear error messages
  3. API returns company-specific pricing when a company has overrides, and default pricing otherwise
  4. Estimate response includes an "estimate only" disclaimer alongside the price range
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD

### Phase 2: Embeddable Widget
**Goal**: Homeowners can use a branded, mobile-friendly widget on any roofing company's website to enter roof details, provide contact info with consent, and see an instant price range
**Depends on**: Phase 1
**Requirements**: WIDG-01, WIDG-02, WIDG-03, WIDG-04, WIDG-05, LEAD-01, LEAD-02
**Success Criteria** (what must be TRUE):
  1. Widget loads on a host page via a single script tag with a company ID attribute, without breaking the host page's styles or layout
  2. Widget walks the homeowner through a multi-step flow: roof details (sqft, pitch, material) then contact info (name, email, phone) with consent checkbox, then displays the estimate
  3. Widget displays the roofing company's logo and primary brand color fetched from the API
  4. Widget is fully usable on mobile devices (all inputs reachable, no horizontal scroll, tap targets adequate)
  5. Consent checkbox is unchecked by default and names the specific roofing company
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD

### Phase 3: Lead Delivery
**Goal**: Roofing companies receive reliable email notifications with full lead details whenever a homeowner submits the widget
**Depends on**: Phase 2
**Requirements**: LEAD-03
**Success Criteria** (what must be TRUE):
  1. Roofing company receives an email with the homeowner's name, email, phone, roof details, and the estimate shown -- within 1 minute of submission
  2. Lead notification emails land in the inbox (not spam) on Gmail, Outlook, and Yahoo
  3. Bot submissions are blocked by honeypot fields and rate limiting so companies receive only real leads
**Plans**: TBD

Plans:
- [ ] 03-01: TBD

### Phase 4: Admin Settings
**Goal**: Roofing companies can self-service their branding, pricing overrides, and embed code without manual database configuration
**Depends on**: Phase 1
**Requirements**: ADMN-01, ADMN-02, ADMN-03, ADMN-04
**Success Criteria** (what must be TRUE):
  1. Company can upload a logo image and see it reflected in the widget
  2. Company can set a primary brand color and see it reflected in the widget
  3. Company can override default material costs and pitch multipliers, and the widget immediately uses the new values
  4. Company can view and copy a ready-to-paste embed code snippet for their website
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. API + Estimate Engine | 0/0 | Not started | - |
| 2. Embeddable Widget | 0/0 | Not started | - |
| 3. Lead Delivery | 0/0 | Not started | - |
| 4. Admin Settings | 0/0 | Not started | - |
