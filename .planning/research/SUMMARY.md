# Project Research Summary

**Project:** Roofing Estimate Calculator
**Domain:** Embeddable SaaS widget (lead generation for roofing companies)
**Researched:** 2026-03-09
**Confidence:** MEDIUM-HIGH

## Executive Summary

This product is an embeddable JavaScript widget that roofing companies place on their websites to capture leads. Homeowners fill out a 4-step form (address/sqft, roof details, contact info, results), receive an instant price range estimate, and the roofing company gets an email notification with the lead. The proven approach for building this type of product is a lightweight Preact widget rendered inside Shadow DOM for CSS isolation, served as a single IIFE bundle from a CDN, backed by an edge-deployed API. The entire stack runs on Cloudflare (Workers, D1, R2, Pages) with a single billing relationship and deployment pipeline. The pricing formula uses industry-standard multipliers for pitch, complexity, and material type, always presenting ranges rather than exact numbers.

The recommended approach prioritizes aggressive simplicity. The widget bundle must stay under 50KB gzipped -- Preact at 3KB is non-negotiable over React's 40KB for a third-party embed. Shadow DOM provides CSS isolation that prevents the widget from breaking host sites and vice versa. Hono on Cloudflare Workers gives a globally distributed API with near-zero operational overhead. D1 (edge SQLite) eliminates the network hop to a separate database. The admin settings page is intentionally minimal: logo upload, color picker, pricing overrides, embed code copy. No CRM, no dashboard, no satellite imagery -- those are anti-features that would delay validation.

The three existential risks are: (1) email deliverability -- if lead notifications land in spam, the entire value proposition collapses; (2) pricing accuracy -- wildly wrong estimates destroy credibility for both the product and the roofing company; and (3) CSS bleed on host sites -- if the widget breaks on real WordPress/Wix/Squarespace sites, companies will remove it. All three must be addressed architecturally from Phase 1, not patched later. Secondary risks include TCPA consent compliance (legal liability), bot spam flooding companies with fake leads, and the practical reality that most roofing company owners cannot paste a script tag without help.

## Key Findings

### Recommended Stack

The stack is unified around the Cloudflare ecosystem with Preact for both frontends. See [STACK.md](STACK.md) for full details.

**Core technologies:**
- **Preact 10.28.x**: Widget and admin UI framework -- 3KB gzipped, React API compatible, purpose-built for embeddable widgets
- **Shadow DOM**: CSS isolation for the widget on host sites -- 96% browser support, prevents style bleed in both directions
- **Hono 4.12.x**: API framework on Cloudflare Workers -- 14KB, edge-native, TypeScript-first, globally distributed
- **Cloudflare D1**: Edge SQLite database -- co-located with Workers, zero network hop, generous free tier (5M reads/day)
- **Drizzle ORM 0.45.x**: Type-safe database queries -- lightweight, first-class D1 support, schema-as-code migrations
- **Resend**: Transactional email -- modern API, React Email templates, 3,000 emails/month free tier
- **Vite 7.x**: Build tooling -- IIFE bundle output for widget, static site for admin
- **Cloudflare R2 + CDN**: Widget bundle hosting -- zero egress fees, global edge delivery

**Cost projection:** $5-25/month total infrastructure for the first 50 customers. Effectively free during validation.

### Expected Features

See [FEATURES.md](FEATURES.md) for full feature landscape including pricing formulas and competitive analysis.

**Must have (table stakes):**
- Address and roof square footage input
- Roof pitch selection (Flat, Low, Medium, Steep)
- Material type selection (3-tab shingles, architectural shingles, standing seam metal)
- Contact info capture (name, email, phone)
- Consent checkbox (TCPA-compliant, unchecked by default, names the specific company)
- Instant price range display (never a single number, rounded to nearest $100)
- Email lead notification to roofing company
- Embeddable via script tag on any website
- Mobile responsive
- Company logo and color theming

**Should have (differentiators):**
- Per-company pricing override controls (base cost/sqft, pitch multipliers, complexity multipliers)
- Roof complexity factor (Simple/Ranch, Average, Complex)
- Estimate breakdown showing how price was calculated
- Tear-off / existing layers toggle

**Defer (v2+):**
- Regional cost auto-adjustment (companies implicitly capture this via pricing overrides)
- Multi-material side-by-side comparison
- QR code generation
- Lead analytics / performance tracking
- Webhook / Zapier / CRM integration
- Financing estimate display

**Anti-features (do not build):**
- Satellite / aerial roof measurement (millions in investment, liability risk)
- Full CRM / lead dashboard (different product)
- Payment processing / SaaS billing (handle offline for v1)
- WordPress plugin (script embed works everywhere)
- Contractor marketplace (conflicts with white-label value prop)

### Architecture Approach

Three independently deployable components connected by a REST API, plus a transactional email service. See [ARCHITECTURE.md](ARCHITECTURE.md) for data flows and component deep-dives.

**Major components:**
1. **Widget Bundle** -- Preact IIFE inside Shadow DOM, served from CDN, fetches config at runtime via company ID
2. **Backend API** -- Hono on Cloudflare Workers, handles config lookup, estimate calculation, lead storage, email dispatch
3. **Admin Settings Page** -- Preact SPA on Cloudflare Pages, manages branding and pricing overrides
4. **Database** -- Cloudflare D1, stores companies, pricing overrides, and leads
5. **Email Service** -- Resend, sends lead notification emails to roofing companies

**Key architectural patterns:**
- Config-at-load, not config-at-build: one widget.js serves all companies, branding applied dynamically
- Optimistic UI: show estimate immediately, send email in background
- Defensive widget loading: try/catch everything, fail silently, never break host page
- Company ID as public identifier: not a secret, not an API key

### Critical Pitfalls

See [PITFALLS.md](PITFALLS.md) for all 10 pitfalls with detailed prevention and recovery strategies.

1. **CSS bleed on host sites** -- Use Shadow DOM from day one. This is architectural and cannot be retrofitted. Test on WordPress, Wix, Squarespace, GoDaddy, and raw HTML before shipping.
2. **Email notifications landing in spam** -- Use Resend with SPF/DKIM/DMARC configured before the first production email. Send from a subdomain. Test deliverability against Gmail, Outlook, Yahoo, and GoDaddy email. Monitor from day one.
3. **Wildly inaccurate estimates** -- Always show ranges, never single numbers. Default to conservative (high) estimates. Make pricing overrides the most prominent admin feature. Validate defaults against 5+ real contractor quotes.
4. **TCPA consent violations** -- Consent checkbox unchecked by default, text dynamically names the specific company, timestamped consent record stored with IP and user agent. Non-negotiable legal requirement.
5. **Widget kills host site performance** -- Keep bundle under 50KB gzipped. Use Preact (3KB) not React (40KB). Load async. No external fonts. Single API call on submission, not on page load.
6. **Bot spam floods fake leads** -- Ship with honeypot fields and IP-based rate limiting from day one. Add timing analysis (reject submissions under 3 seconds). Defer reCAPTCHA v3 until spam is observed.

## Implications for Roadmap

Based on combined research, the dependency chain and risk profile suggest 4 phases.

### Phase 1: API Foundation + Database

**Rationale:** Both frontends depend on the API. The database schema must include tenant isolation from the start (adding it later is dangerous with PII data). The pricing formula is the core product logic and must be validated early.
**Delivers:** Working API with config lookup, estimate calculation, and lead storage. Seeded test company.
**Features addressed:** Pricing formula with sqft/pitch/complexity/material multipliers, company config CRUD, lead storage
**Pitfalls avoided:** Tenant data isolation (schema-level from day one), pricing inaccuracy (validate formula with example calculations)
**Stack elements:** Hono, Cloudflare Workers, D1, Drizzle, Zod, shared validation schemas

### Phase 2: Embeddable Widget

**Rationale:** This IS the product. The widget must be built on Shadow DOM from the first line of code -- retrofitting is a near-complete rewrite. Bundle size discipline must be enforced immediately because the framework choice locks in a size floor.
**Delivers:** Functional 4-step calculator widget that can be embedded on any site via script tag. Fetches company config, renders branded form, submits estimate, displays price range.
**Features addressed:** Script tag embed, Shadow DOM isolation, multi-step form (address/sqft, roof details, contact info, results), instant price range display, company branding, mobile responsive, consent checkbox
**Pitfalls avoided:** CSS bleed (Shadow DOM), performance degradation (Preact + async loading), mobile breakage (mobile-first design), CSP blocking (test across platforms)
**Stack elements:** Preact, Vite (IIFE output), Shadow DOM, @preact/signals, R2 + CDN for hosting

### Phase 3: Email Delivery + Lead Capture Hardening

**Rationale:** Email is the value delivery mechanism -- the roofing company only gets value when they receive the lead notification. Email deliverability and spam protection must be production-grade before any real company uses the product. This phase also hardens the submission pipeline against bots and ensures TCPA compliance.
**Delivers:** Reliable lead notification emails, bot protection, consent audit trail
**Features addressed:** Email lead notification with full details and estimate, honeypot fields, rate limiting, TCPA-compliant consent recording
**Pitfalls avoided:** Emails landing in spam (SPF/DKIM/DMARC + deliverability testing), bot spam (honeypot + rate limiting + timing analysis), TCPA violations (proper consent architecture)
**Stack elements:** Resend, React Email templates

### Phase 4: Admin Settings Page + Onboarding

**Rationale:** The admin page is a supporting tool, not the product. During early testing, companies can be configured manually in the database. But for self-service onboarding (required before scaling), companies need to manage their own branding, pricing overrides, and embed code.
**Delivers:** Self-service admin portal with authentication, branding configuration, pricing override management, embed code generation with copy button
**Features addressed:** Logo upload, color picker, pricing override controls, embed code display, platform-specific embed guides
**Pitfalls avoided:** Roofing companies unable to embed the widget (platform-specific guides with screenshots), tenant settings accessible without auth (session-based authentication)
**Stack elements:** Preact, Vite, Cloudflare Pages

### Phase Ordering Rationale

- **API first** because both frontends depend on it and the pricing formula needs early validation
- **Widget second** because it is the product and Shadow DOM must be foundational, not retrofitted
- **Email third** because it can be wired in after the widget works, but must be production-grade before real customers use it
- **Admin last** because companies can be configured manually during early testing; self-service is needed for scale, not validation
- This order matches the architecture's dependency chain: Database -> API -> Widget -> Email -> Admin

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Widget):** Shadow DOM + Preact integration specifics, IIFE build configuration in Vite, `document.currentScript` behavior with async scripts. Well-documented individually but the combination has nuances.
- **Phase 3 (Email):** Resend + React Email template setup, SPF/DKIM/DMARC DNS configuration. Standard patterns but must be done correctly the first time.

Phases with standard patterns (skip deep research):
- **Phase 1 (API + Database):** Hono + D1 + Drizzle is well-documented with official integration guides and tutorials. CRUD API with Zod validation is standard.
- **Phase 4 (Admin):** Standard Preact SPA with form inputs. Authentication is the only area that might need a quick pattern check.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All technologies are mature, well-documented, and specifically suited for this use case. Preact + Shadow DOM for widgets is battle-tested (Sentry, CompanyCam). Cloudflare ecosystem is production-proven. |
| Features | MEDIUM-HIGH | Table stakes are clear from competitor analysis. Pricing formula uses real industry data (HomeGuide, FieldCamp, 2025-2026 figures). Complexity multipliers are approximate -- companies must be able to override. |
| Architecture | HIGH | Script tag + Shadow DOM + CDN-hosted widget is the established pattern for embeddable SaaS. Config-at-load is standard. Component boundaries are clean and well-understood. |
| Pitfalls | HIGH | Research identified domain-specific risks (TCPA, pricing accuracy, embed difficulty) beyond generic web pitfalls. Prevention strategies are concrete and phase-mapped. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **Authentication approach for admin:** Research lightly covered this. Need to decide between rolling minimal auth (bcrypt + cookies) vs. a lightweight library (Better Auth, Lucia). Decide during Phase 4 planning.
- **D1 limitations at scale:** D1 is GA but relatively new. If a company generates thousands of leads per day, D1's write limits (100K writes/day free tier) could become a concern. Monitor and plan Postgres migration path via Drizzle if needed.
- **Cache invalidation for widget config:** Research recommends no cache invalidation for v1 (config fetch on every widget load). At scale (100+ companies), the config endpoint should cache responses with a short TTL. Design the config endpoint to support caching headers from the start.
- **Pricing formula validation:** Default multipliers are sourced from industry data but have not been validated against actual contractor quotes. Before launching with real customers, compare formula output to 5+ real estimates from different markets.
- **CSP compatibility on managed platforms:** Wix, Squarespace, and WordPress.com may block external scripts. Need platform-specific testing before claiming "works on any website." May need an iframe fallback for restrictive platforms.

## Sources

### Primary (HIGH confidence)
- [Preact official site](https://preactjs.com/) -- framework size, API compatibility
- [Hono official site](https://hono.dev/) -- framework capabilities, Worker integration
- [Cloudflare D1 docs](https://developers.cloudflare.com/d1/) -- pricing, limits, D1 GA status
- [Drizzle ORM + D1 integration](https://orm.drizzle.team/docs/connect-cloudflare-d1) -- official setup docs
- [Sentry Engineering: Preact for embedded widgets](https://sentry.engineering/blog/preact-or-svelte-an-embedded-widget-use-case/) -- real-world framework comparison
- [CompanyCam: Preact + Shadow DOM widget](https://dev.to/companycam/build-an-embeddable-widget-using-preact-and-the-shadow-dom-33lm) -- implementation reference
- [web.dev: Third-party embed best practices](https://web.dev/articles/embed-best-practices) -- Google's performance guidance
- [FCC TCPA one-to-one consent mandate](https://www.orrick.com/en/Insights/2023/12/FCC-Closes-TCPA-Lead-Generator-Loophole-Requires-One-to-One-Consent) -- legal requirements

### Secondary (MEDIUM confidence)
- [HomeGuide: Roof Replacement Cost 2026](https://homeguide.com/costs/roof-replacement-cost) -- material pricing data
- [FieldCamp: How to Price a Roofing Job](https://fieldcamp.ai/blog/how-to-price-a-roofing-job/) -- pricing formula, multipliers
- [RoofObservations: Construction Costs by State](https://roofobservations.com/relative-construction-costs-by-state/) -- regional multipliers (approximate)
- [Hono vs Fastify benchmarks](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/) -- performance comparison
- [HD Roofers: Why Roof Cost Calculators Don't Add Up](https://hdroofers.com/roof-replacement-cost-calculator-doesnt-add-up/) -- 20% average error rate context

### Tertiary (LOW confidence)
- [SimpleRoof Estimates](https://simpleroofestimates.com) -- closest competitor but limited public documentation
- Complexity multiplier values -- contractor rules of thumb, not standardized; companies must override

---
*Research completed: 2026-03-09*
*Ready for roadmap: yes*
