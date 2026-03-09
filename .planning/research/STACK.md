# Technology Stack

**Project:** Roofing Estimate Calculator (Embeddable SaaS Widget)
**Researched:** 2026-03-09

## Recommended Stack

### Widget (Embeddable Frontend)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Preact | 10.28.x | Widget UI framework | 3KB gzipped -- critical for an embed that loads on someone else's site. React API compatibility means familiar DX without the 40KB tax. Sentry chose Preact for their embed widget for the same reason. | HIGH |
| Shadow DOM | (Web API) | Style isolation | Prevents host site CSS from breaking the widget and widget CSS from leaking out. 96% browser support. The standard approach for modern embeddable widgets. | HIGH |
| Vite | 7.x | Build tooling | Builds the widget as a single IIFE bundle. Fast dev server, tree-shaking, CSS inlining into Shadow DOM. | HIGH |
| TypeScript | 5.x | Type safety | Non-negotiable for any production project in 2026. | HIGH |

**Embed strategy:** Script tag with `data-company-id` attribute. The script loads a self-contained IIFE bundle that creates a Shadow DOM container and renders the Preact widget inside it. No iframe -- avoids the communication overhead, memory cost, and sizing headaches. The widget fetches pricing config from the API using the company ID.

```html
<!-- Customer adds this to their site -->
<div id="roofing-calculator"></div>
<script src="https://cdn.yourdomain.com/widget.js" data-company-id="abc123"></script>
```

### Admin Settings Page (Internal Frontend)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Preact | 10.28.x | Admin UI framework | Same framework as the widget -- one learning curve, shared utilities. The admin page is tiny (logo upload, color picker, pricing overrides). No need for a heavier framework. | HIGH |
| Vite | 7.x | Build tooling | Same build pipeline as the widget. | HIGH |

**Why not a separate framework for admin?** The admin page is ~3-4 screens. Using the same Preact stack avoids maintaining two frontend ecosystems. If the admin grows significantly later, migrating to React is trivial (Preact is API-compatible).

### Backend / API

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Hono | 4.12.x | API framework | Ultrafast (14KB), runs natively on Cloudflare Workers. Built on Web Standards so it works everywhere. TypeScript-first with excellent DX. 3x faster than Express, 30% less memory than Fastify. Perfect for a simple CRUD + estimate API. | HIGH |
| Zod | 3.x | Request validation | Pairs naturally with Hono's validator middleware. Schema-first validation for form submissions and settings updates. | HIGH |

**Why Hono over Fastify/Express?** This API is small (estimate calculation, settings CRUD, lead submission). Hono's edge-native design means the API runs on Cloudflare Workers globally with no server management. Fastify is excellent but Node.js-specific -- Hono gives us edge deployment for free.

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Cloudflare D1 | GA | Primary database (SQLite at the edge) | Native integration with Workers -- no network hop to a separate database. Free tier is absurdly generous (5M reads/day, 100K writes/day, 5GB storage). For a lead-gen widget handling hundreds of submissions per day, this is effectively free for years. | MEDIUM |
| Drizzle ORM | 0.45.x | Type-safe database queries | Lightweight, TypeScript-native, first-class D1 support. Schema-as-code with migrations. Much lighter than Prisma (which has edge compatibility issues). | HIGH |

**Why D1 over Postgres (Supabase/Neon)?** This app has simple relational data: companies, settings, leads. No complex queries, no joins across 15 tables. D1's SQLite engine handles this perfectly, and being co-located with the Worker eliminates latency. If the app outgrows D1 (unlikely for v1), Drizzle makes migrating to Postgres straightforward -- just change the dialect.

**Schema is simple:**
- `companies` (id, name, logo_url, primary_color, created_at)
- `pricing_overrides` (company_id, base_price_per_sqft, pitch_multipliers, complexity_multipliers)
- `leads` (id, company_id, address, sqft, pitch, complexity, name, email, phone, estimate_low, estimate_high, created_at)

### Email Delivery

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Resend | API v2 | Transactional lead notification emails | Modern developer-first API, React Email integration for templating, 3,000 emails/month free tier (plenty for early customers). Clean SDK, transparent pricing ($20/mo for 50K emails when scaling). | HIGH |

**Why Resend over Postmark/SendGrid?**
- Postmark has better deliverability track record but costs more and the API feels dated.
- SendGrid is bloated with marketing features this project will never use.
- Resend's React Email lets us build email templates in JSX (same mental model as the rest of the app). For lead notification emails that must be reliable but aren't high-volume, Resend is the right balance of DX and reliability.

**Risk mitigation:** If deliverability becomes an issue, Resend can be swapped for Postmark with minimal code changes (both are simple REST APIs). Monitor delivery rates from day one.

### Static Asset Hosting (Widget Bundle)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Cloudflare R2 + CDN | GA | Host the widget.js bundle | The widget JS must load fast on customer sites worldwide. R2 gives S3-compatible storage with Cloudflare's CDN in front -- zero egress fees. Widget bundle served from edge locations globally. | HIGH |

### Hosting / Deployment

| Technology | Purpose | Why | Confidence |
|------------|---------|-----|------------|
| Cloudflare Workers | API hosting | Hono runs natively. Global edge deployment. $5/mo paid plan includes 10M requests. No servers to manage. | HIGH |
| Cloudflare Pages | Admin app hosting | Static site hosting with preview deployments. Free tier is generous. | HIGH |
| Cloudflare R2 | Widget bundle + company logos | Zero egress fees. CDN-backed. | HIGH |

**Why Cloudflare over Railway/Fly.io/Vercel?**
The entire stack runs on one platform: Workers (API), Pages (admin), R2 (assets), D1 (database). Single billing, single deploy pipeline, single CLI (`wrangler`). No vendor-mixing complexity. The free tier covers development and early customers. Paid tier ($5/mo base) handles significant scale.

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @hono/zod-validator | latest | Request validation middleware | Every API endpoint |
| drizzle-kit | latest | Database migrations CLI | Schema changes |
| react-email | latest | Email template components | Lead notification emails |
| @preact/signals | 2.x | Reactive state in widget | Multi-step form state management |
| nanoid | 5.x | ID generation | Company IDs, lead IDs |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Widget framework | Preact | React 19 | 13x larger bundle (40KB vs 3KB). Unacceptable for a third-party embed. |
| Widget framework | Preact | Svelte 5 | Smaller output but different paradigm. Preact's React compatibility means easier hiring and more ecosystem support. |
| Widget framework | Preact | Vanilla JS | No component model, manual DOM management. The 4-step form with validation needs a framework. |
| Embed strategy | Script tag + Shadow DOM | iframe | Memory overhead, sizing issues (dynamic height), postMessage complexity. Iframe is overkill for a trusted first-party widget. |
| Backend | Hono on Workers | Next.js API routes | Massive framework for a simple API. Next.js adds SSR complexity we don't need. |
| Backend | Hono on Workers | Fastify on Railway | Excellent framework but ties us to a Node.js server. Workers gives global edge for free. |
| Database | D1 (SQLite) | Supabase (Postgres) | Overkill. Adds another vendor, another bill, network latency to a managed Postgres. D1 is co-located with the Worker. |
| Database | D1 (SQLite) | Neon (Postgres) | Reliability concerns (multiple 2025 outages). Also overkill for this data model. |
| ORM | Drizzle | Prisma | Prisma has edge runtime issues, larger bundle, slower cold starts. Drizzle is purpose-built for this environment. |
| Email | Resend | Postmark | Better deliverability but higher cost and less modern DX. Can swap later if needed. |
| Email | Resend | SendGrid | Bloated with marketing features. Worse DX. Reliability has declined. |
| Hosting | Cloudflare | Vercel + separate DB | More expensive, splits infrastructure across vendors, no built-in D1 equivalent. |

## Installation

```bash
# Initialize Cloudflare Workers project with Hono
npm create hono@latest roofing-api -- --template cloudflare-workers

# Core API dependencies
npm install hono drizzle-orm @hono/zod-validator zod nanoid

# Dev dependencies
npm install -D drizzle-kit wrangler typescript @types/node

# Widget project (separate package or monorepo workspace)
npm install preact @preact/signals
npm install -D vite @preact/preset-vite typescript

# Admin project
npm install preact @preact/signals
npm install -D vite @preact/preset-vite typescript

# Email templates
npm install resend @react-email/components react-email
```

## Monorepo Structure

```
roofing_calculator/
  packages/
    api/           # Hono on Cloudflare Workers
    widget/        # Preact widget (builds to IIFE bundle)
    admin/         # Preact admin app (builds to static site)
    shared/        # Shared types, validation schemas (Zod)
    email/         # React Email templates
```

Use npm workspaces (no need for Turborepo at this scale). Shared Zod schemas ensure API request/response types stay in sync between widget, admin, and API.

## Cost Projection

| Component | Free Tier | When to Pay | Paid Cost |
|-----------|-----------|-------------|-----------|
| Workers (API) | 100K requests/day | >100K req/day | $5/mo base + $0.30/M requests |
| D1 (Database) | 5M reads/day, 5GB | >5M reads/day | $5/mo base (included with Workers paid) |
| R2 (Assets) | 10GB storage, 10M reads/mo | >10M reads/mo | $0.015/GB storage |
| Pages (Admin) | 500 builds/mo, unlimited bandwidth | Unlikely to exceed | $0/mo |
| Resend (Email) | 3,000 emails/mo | ~30 active companies | $20/mo |

**Estimated cost for first 50 customers:** $5-25/mo total infrastructure. This stack is effectively free during validation.

## Sources

- [Preact official site](https://preactjs.com/) -- 3KB gzipped, React API compatibility
- [Sentry Engineering: Preact or Svelte for embedded widgets](https://sentry.engineering/blog/preact-or-svelte-an-embedded-widget-use-case/) -- real-world widget framework comparison
- [Build embeddable widget with Preact and Shadow DOM](https://dev.to/companycam/build-an-embeddable-widget-using-preact-and-the-shadow-dom-33lm) -- implementation guide
- [Hono official site](https://hono.dev/) -- Web Standards framework, multi-runtime
- [Hono vs Fastify comparison](https://betterstack.com/community/guides/scaling-nodejs/hono-vs-fastify/) -- performance benchmarks
- [Drizzle ORM + Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1) -- official integration docs
- [Cloudflare D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) -- free tier and paid pricing
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) -- free and paid tiers
- [Resend pricing](https://resend.com/pricing) -- 3,000 emails/mo free, $20/mo pro
- [Resend pricing analysis](https://flexprice.io/blog/detailed-resend-pricing-guide) -- detailed plan comparison
- [Vite 7 release](https://vite.dev/releases) -- current stable version
- [Makerkit: React embeddable widget starter](https://github.com/makerkit/react-embeddable-widget) -- reference implementation
- [Hono + D1 + Drizzle setup guide](https://www.firdausng.com/posts/setup-d1-cloudflare-worker-with-drizzle) -- practical integration tutorial
