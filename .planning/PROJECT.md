# Roofing Estimate Calculator

## What This Is

A SaaS embeddable widget that roofing companies add to their websites to generate leads. Homeowners enter roof details (sqft, pitch, material) and contact info, receive an instant price range estimate, and the roofing company gets notified via email with the lead. Homeowners can optionally measure their roof on a satellite map with polygon drawing and pitch-adjusted sqft auto-calculation. Each company gets an admin portal to customize branding, override pricing, and grab their embed code.

## Core Value

Homeowners get an instant, credible roof estimate — and the roofing company captures a qualified lead with contact info and project details.

## Requirements

### Validated

- ✓ Homeowner can enter roof square footage (100-10,000 sqft range) — v1.0
- ✓ Homeowner can select roof pitch (Flat, Low, Medium, Steep) — v1.0
- ✓ Homeowner can select material type (3-tab, architectural, standing seam metal) — v1.0
- ✓ Homeowner sees estimated price range after submitting — v1.0
- ✓ Price uses formula: sqft x pitch_multiplier x complexity_multiplier x material_cost — v1.0
- ✓ Estimates rounded to nearest $100 with disclaimer — v1.0
- ✓ Homeowner can enter contact info (first name, last name, email, phone) — v1.0
- ✓ TCPA-compliant consent checkbox (unchecked default, names company) — v1.0
- ✓ Roofing company receives email with lead details within 1 minute — v1.0
- ✓ Widget embeddable via single script tag with company ID — v1.0
- ✓ Widget renders in Shadow DOM for CSS isolation — v1.0
- ✓ Widget fully responsive and mobile-friendly — v1.0
- ✓ Widget displays company logo and primary brand color — v1.0
- ✓ Widget follows multi-step flow: roof details -> contact -> estimate — v1.0
- ✓ Company can upload logo image — v1.0
- ✓ Company can set primary brand color — v1.0
- ✓ Company can override material costs and multipliers — v1.0
- ✓ Company can view and copy embed code snippet — v1.0
- ✓ Address autocomplete with Google Places API — v1.1
- ✓ Satellite map preview of the homeowner's roof — v1.1
- ✓ Polygon drawing tool to trace roof outline on map — v1.1
- ✓ Auto-calculate footprint area from polygon — v1.1
- ✓ Adjust calculated sqft for selected roof pitch — v1.1
- ✓ Auto-fill sqft field from map measurement — v1.1
- ✓ Manual sqft entry still works as fallback — v1.1
- ✓ Property address from map mode included in lead email — v1.1

### Active

#### Current Milestone: v2.0 Admin Platform & Lead Management

**Goal:** Transform the admin from a settings panel into a full platform — lead management, RBAC, analytics, security hardening, and widget UX improvements.

- [ ] Admin can view list of leads per company with search/filter
- [ ] Admin can export leads as CSV per company
- [ ] Customer receives PDF or email copy of their estimate
- [ ] Super-admin role can manage all companies; company-admin can only manage their own
- [ ] Login endpoint is rate-limited
- [ ] Session expiry triggers auto-redirect to login
- [ ] CSRF protection on all form submissions
- [ ] Admin can soft-delete/archive a company
- [ ] Live widget preview in admin branding editor
- [ ] Pricing inputs validate low < high, no negatives, sensible ranges
- [ ] Admin sees per-company stats: total estimates, total leads, popular materials
- [ ] User can go back and edit roof details after viewing estimate without re-entering contact info
- [ ] Widget shows specific error messages from API instead of generic failures
- [ ] Remove legacy session-scoped admin routes
- [ ] Add DB indexes on leads.companyId and leads.createdAt
- [ ] Pagination on leads and companies list endpoints

### Out of Scope

- ~~Lead management dashboard~~ — moved to v2.0 Active
- CRM integrations (HubSpot, Salesforce, etc.) — v2
- WordPress plugin — script embed only for v1
- Full theme control (fonts, spacing, etc.) — colors + logo only for v1
- Payment processing / billing for SaaS subscriptions — handle offline for v1
- SMS/text notifications to roofing company — email only for v1
- Contractor marketplace / matching — different business model
- Permit cost estimation — varies by municipality
- Exact / guaranteed pricing — liability risk, always show ranges
- OAuth / social login for admin — email/password sufficient
- AI/ML automatic roof detection — requires expensive server-side image processing
- Exact pitch detection from satellite — 2D imagery cannot determine pitch
- Multiple roof sections/facets — blows up 4-step max constraint
- Storing polygon GeoJSON in database — no downstream use; sqft number is all that matters
- Per-company Google Maps API keys — over-complex for v1; single SaaS-managed key

## Context

- Shipped v1.1 with ~5,254 LOC TypeScript across 3 packages (api, widget, admin)
- Tech stack: Hono + Cloudflare Workers, D1 (SQLite), R2 (blob storage), Drizzle ORM, Preact, Vite, Zod, Resend API
- Google Maps JS API + Terra Draw loaded via CDN (lazy, no bundle impact)
- Widget builds as single IIFE bundle with Shadow DOM isolation
- ~95 automated tests (60 API + 35 widget), all passing
- Competitor reference: SimpleRoof Estimates (simpleroofestimates.com)
- Target customers: small-to-mid roofing companies
- Pricing formula defaults need validation against real contractor quotes before launch

## Constraints

- **Embed size**: Widget must be lightweight and not break host websites
- **Simplicity**: 4-step flow max — homeowners abandon long forms
- **Mobile**: Must work on mobile — many homeowners browse on phones
- **Email delivery**: Lead emails must be reliable — this is the core value delivery
- **D1 limits**: 100K writes/day on free tier — monitor for high-volume companies
- **Maps API costs**: Session tokens required for Places API; single shared API key with referrer restrictions

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manual sqft entry over API lookup | Simpler v1, no API costs | ✓ Good |
| Script tag embed over WordPress plugin | Works on any site | ✓ Good |
| Email leads over dashboard | Ship faster, validate demand | ✓ Good |
| Generic pricing formula with overrides | Let companies customize | ✓ Good |
| Cloudflare Workers + D1 + R2 | Zero-config, global edge, free tier | ✓ Good |
| Preact over React for widget | 3KB vs 40KB, Shadow DOM compatible | ✓ Good |
| PBKDF2 over bcrypt | bcrypt incompatible with Workers runtime | ✓ Good |
| Shadow DOM for CSS isolation | Prevents host site style conflicts | ✓ Good |
| Zod superRefine for conditional validation | All-or-nothing contact fields | ✓ Good |
| Lead storage as side effect of estimate POST | No separate endpoint needed | ✓ Good |
| Honeypot in route handler (not schema) | Returns fake 200 instead of 400 | ✓ Good |
| Email via waitUntil with .catch() | Never blocks estimate response | ✓ Good |
| Session cookies over JWT | Simple, secure, httpOnly | ✓ Good |
| AutocompleteSuggestion over legacy Autocomplete | Legacy blocked for new keys since March 2025 | ✓ Good |
| Terra Draw over DrawingManager | DrawingManager deprecated Aug 2025, removed May 2026 | ✓ Good |
| Google Maps via CDN, not bundled | Preserves widget bundle size | ✓ Good |
| Terra Draw via CDN script injection | Vite inlineDynamicImports prevents code splitting | ✓ Good |
| Single shared GOOGLE_MAPS_API_KEY | Per-company keys deferred to v2; referrer restrictions | ✓ Good |
| Portal rendering for autocomplete dropdown | Shadow DOM prevents nested dropdown positioning | ✓ Good |
| No polygon GeoJSON in DB | Extract sqft client-side, discard geometry; D1 write limits | ✓ Good |
| Optional address field through entire stack | Undefined = manual entry, present = map mode; backward compatible | ✓ Good |

---
*Last updated: 2026-03-24 after v2.0 milestone started*
