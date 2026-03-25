# Roofing Estimate Calculator

## What This Is

A SaaS embeddable widget that roofing companies add to their websites to generate leads. Homeowners enter roof details (sqft, pitch, material) and contact info, receive an instant price range estimate, and both the roofing company and homeowner get notified via email. Homeowners can optionally measure their roof on a satellite map with polygon drawing and pitch-adjusted sqft auto-calculation. Each company gets a full admin portal with RBAC, lead management (search, filter, CSV export), per-company analytics, branding customization with live preview, and pricing controls with validation.

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

- ✓ Admin can view list of leads per company with search/filter — v2.0
- ✓ Admin can export leads as CSV per company — v2.0
- ✓ Customer receives email copy of their estimate — v2.0
- ✓ Super-admin role can manage all companies; company-admin scoped to own — v2.0
- ✓ Login endpoint is rate-limited (5 attempts/60s) — v2.0
- ✓ Session expiry triggers auto-redirect to login — v2.0
- ✓ CSRF protection on all state-changing endpoints — v2.0
- ✓ Admin can soft-delete/archive a company — v2.0
- ✓ Live widget preview in admin branding editor — v2.0
- ✓ Pricing inputs validate low < high, no negatives, sensible ranges — v2.0
- ✓ Admin sees per-company stats: total estimates, total leads, popular materials — v2.0
- ✓ User can go back and edit roof details without re-entering contact info — v2.0
- ✓ Widget shows specific error messages from API — v2.0
- ✓ Legacy session-scoped admin routes removed — v2.0
- ✓ DB indexes on leads.companyId and leads.createdAt — v2.0
- ✓ Pagination on leads and companies list endpoints — v2.0

### Active

No active requirements. Next milestone not yet defined.

### Out of Scope

- CRM integrations (HubSpot, Salesforce, etc.) — future milestone
- WordPress plugin — script embed works on any site
- Full theme control (fonts, spacing, etc.) — colors + logo sufficient
- Payment processing / billing for SaaS subscriptions — handle offline
- SMS/text notifications to roofing company — email sufficient
- Contractor marketplace / matching — different business model
- Permit cost estimation — varies by municipality
- Exact / guaranteed pricing — liability risk, always show ranges
- OAuth / social login for admin — email/password sufficient
- AI/ML automatic roof detection — requires expensive server-side image processing
- Exact pitch detection from satellite — 2D imagery cannot determine pitch
- Multiple roof sections/facets — blows up 4-step max constraint
- Per-company Google Maps API keys — single SaaS-managed key with referrer restrictions

## Context

- Shipped v2.0 with ~10,400 LOC TypeScript/CSS across 3 packages (api, widget, admin)
- Tech stack: Hono + Cloudflare Workers, D1 (SQLite), R2 (blob storage), Drizzle ORM, Preact, Vite, Zod, Resend API
- Google Maps JS API + Terra Draw loaded via CDN (lazy, no bundle impact)
- Widget builds as single IIFE bundle with Shadow DOM isolation
- 120 automated tests (78 API + 25 estimates + 8 lead-notification + 2 maps + 7 engine), all passing
- RBAC: super-admin and company-admin roles enforced server-side
- Security: CSRF protection, login rate limiting, session expiry redirect
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
| RBAC enforced server-side, not just UI | company-admin must be checked at API layer | ✓ Good |
| CSRF via Origin header + token fallback | Simpler than double-submit cookie; works with SPA | ✓ Good |
| Rate limiting via CF Workers RateLimit binding | In-memory Map fallback for testing | ✓ Good |
| Soft-delete with archivedAt timestamp | Preserves data, allows restore; better than boolean | ✓ Good |
| Widget preview as inline mock, not iframe | Avoids cross-origin issues in dev | ✓ Good |
| Customer estimate email via waitUntil | Same pattern as lead notification; never blocks response | ✓ Good |
| Stats via SQL aggregation, not client-side | COUNT, AVG, GROUP BY — efficient for any data size | ✓ Good |
| CSV export as dedicated endpoint | Separate from paginated list; full data dump | ✓ Good |
| goToStep without resetting formData | Contact info preserved on back-navigation | ✓ Good |

---
*Last updated: 2026-03-25 after v2.0 milestone complete*
