# Roofing Estimate Calculator

## What This Is

A SaaS embeddable widget that roofing companies add to their websites to generate leads. Homeowners enter their roof details and contact info, receive an instant price range estimate, and the roofing company gets notified via email with the lead. Each company gets a minimal settings page to customize branding and override default pricing.

## Core Value

Homeowners get an instant, credible roof estimate — and the roofing company captures a qualified lead with contact info and project details.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Homeowner can enter property address and roof square footage
- [ ] Homeowner can select roof pitch (Flat, Low, Medium, Steep)
- [ ] Homeowner can select roof complexity (Simple/Ranch, Average, Complex/Multi-level)
- [ ] Homeowner can enter contact info (first name, last name, email, phone)
- [ ] Homeowner sees consent checkbox for communications before submitting
- [ ] Homeowner receives an estimated price range after submitting
- [ ] Price estimate uses a generic formula with sqft, pitch, and complexity multipliers
- [ ] Roofing company can override default pricing parameters
- [ ] Roofing company receives email notification with lead details when a homeowner submits
- [ ] Widget is embeddable via script tag / iframe snippet
- [ ] Roofing company has a minimal settings page (logo, primary color, pricing overrides)
- [ ] Widget displays the roofing company's logo and primary brand color

### Out of Scope

- Property data API / auto-lookup of roof sqft — manual entry for v1
- Lead management dashboard — email notifications only for v1
- CRM integrations (HubSpot, Salesforce, etc.) — v2
- WordPress plugin — script embed only for v1
- Full theme control (fonts, spacing, etc.) — colors + logo only for v1
- Payment processing / billing for SaaS subscriptions — handle offline for v1
- SMS/text notifications to roofing company — email only for v1

## Context

- Competitor reference: SimpleRoof Estimates (simpleroofestimates.com) — similar 4-step flow
- Target customers: Roofing companies, typically small-to-mid businesses
- Most roofing company sites are basic (WordPress, Wix, etc.) — embed must be dead simple
- Homeowners are the end users but roofing companies are the paying customers
- Pricing formula needs research — standard roofing cost factors include material type, sqft, pitch, complexity, and regional variation

## Constraints

- **Embed size**: Widget must be lightweight and not break host websites
- **Simplicity**: 4-step flow max — homeowners abandon long forms
- **Mobile**: Must work on mobile — many homeowners browse on phones
- **Email delivery**: Lead emails must be reliable — this is the core value delivery

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Manual sqft entry over API lookup | Simpler v1, no API costs, homeowners often know their sqft | — Pending |
| Script tag embed over WordPress plugin | Works on any site, not just WordPress | — Pending |
| Email leads over dashboard | Ship faster, validate demand before building dashboard | — Pending |
| Generic pricing formula with overrides | Research standard pricing, let companies customize | — Pending |

---
*Last updated: 2026-03-09 after initialization*
