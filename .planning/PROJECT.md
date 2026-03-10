# Roofing Estimate Calculator

## What This Is

A SaaS embeddable widget that roofing companies add to their websites to generate leads. Homeowners enter roof details (sqft, pitch, material) and contact info, receive an instant price range estimate, and the roofing company gets notified via email with the lead. Each company gets an admin portal to customize branding, override pricing, and grab their embed code.

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

### Active

(None — define in next milestone)

### Out of Scope

- Property data API / auto-lookup of roof sqft — manual entry for v1
- Lead management dashboard — email notifications only for v1
- CRM integrations (HubSpot, Salesforce, etc.) — v2
- WordPress plugin — script embed only for v1
- Full theme control (fonts, spacing, etc.) — colors + logo only for v1
- Payment processing / billing for SaaS subscriptions — handle offline for v1
- SMS/text notifications to roofing company — email only for v1
- Satellite/aerial roof measurement — multi-million dollar investment
- Contractor marketplace / matching — different business model
- Permit cost estimation — varies by municipality
- Exact / guaranteed pricing — liability risk, always show ranges
- OAuth / social login for admin — email/password sufficient

## Context

- Shipped v1.0 with 3,522 LOC TypeScript across 3 packages (api, widget, admin)
- Tech stack: Hono + Cloudflare Workers, D1 (SQLite), R2 (blob storage), Drizzle ORM, Preact, Vite, Zod, Resend API
- Widget builds as 28KB gzipped single IIFE bundle
- 63 automated tests (54 API + 9 widget), all passing
- Competitor reference: SimpleRoof Estimates (simpleroofestimates.com)
- Target customers: small-to-mid roofing companies
- Pricing formula defaults need validation against real contractor quotes before launch

## Constraints

- **Embed size**: Widget must be lightweight and not break host websites
- **Simplicity**: 4-step flow max — homeowners abandon long forms
- **Mobile**: Must work on mobile — many homeowners browse on phones
- **Email delivery**: Lead emails must be reliable — this is the core value delivery
- **D1 limits**: 100K writes/day on free tier — monitor for high-volume companies

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

---
*Last updated: 2026-03-10 after v1.0 milestone*
