# Architecture Patterns

**Domain:** Embeddable SaaS widget (roofing estimate calculator)
**Researched:** 2026-03-09

## Recommended Architecture

Three distinct deployable components plus a transactional email service:

```
+------------------+        +-------------------+        +------------------+
|  Embeddable      |  API   |  Backend API      |  SMTP  |  Email Service   |
|  Widget (JS)     | -----> |  Server           | -----> |  (Resend)        |
|  (CDN-hosted)    |        |  (Node/Express    |        |                  |
|                  |        |   or Hono)        |        +------------------+
+------------------+        |                   |
                            |                   |
+------------------+        |                   |        +------------------+
|  Admin Settings  |  API   |                   |  R/W   |  Database        |
|  Page (SPA)      | -----> |                   | <----> |  (SQLite/Turso   |
|                  |        |                   |        |   or Postgres)   |
+------------------+        +-------------------+        +------------------+
```

**Why this shape:** The widget must be a standalone JS bundle served from a CDN -- it cannot share a deployment with the admin UI or API. The admin page is a separate, conventional web app behind authentication. The API sits between both frontends and the database. Email delivery is outsourced to a transactional email provider because reliable deliverability is the core value proposition.

### Component Boundaries

| Component | Responsibility | Communicates With | Deployment |
|-----------|---------------|-------------------|------------|
| **Widget Bundle** | Multi-step estimate form, renders inside Shadow DOM on customer sites | Backend API (HTTPS POST) | CDN (static JS file) |
| **Backend API** | Tenant config lookup, estimate calculation, lead storage, email dispatch | Database, Email service, both frontends | Single server or serverless |
| **Admin Settings Page** | Company branding config (logo, color), pricing override management, embed code copy | Backend API | Static hosting or same server |
| **Database** | Tenant configs, pricing parameters, lead records | Backend API only |  Managed DB |
| **Email Service** | Transactional lead notification emails to roofing companies | Backend API (outbound only) | Third-party SaaS |

### Data Flow

**Widget Submission Flow (the core path):**

```
1. Homeowner lands on roofing company website
2. Browser loads widget.js from CDN (script tag with data-company-id)
3. Widget reads data-company-id from script tag via document.currentScript
4. Widget calls GET /api/config/:companyId to fetch branding + pricing params
5. Widget renders form inside Shadow DOM with company colors/logo
6. Homeowner fills 4-step form: address/sqft -> pitch -> complexity -> contact info
7. Widget calls POST /api/estimates with form data + companyId
8. Backend calculates price range using company's pricing params
9. Backend stores lead in database
10. Backend sends lead email to company via Resend
11. Backend returns estimate result to widget
12. Widget displays price range to homeowner
```

**Admin Configuration Flow:**

```
1. Company owner visits admin page, authenticates
2. Admin page loads current config via GET /api/admin/config
3. Owner updates logo URL, brand color, pricing multipliers
4. Admin page saves via PUT /api/admin/config
5. Next widget load picks up new config (no cache invalidation needed for v1)
```

## Component Deep-Dives

### 1. Embeddable Widget

**Embedding pattern:** Single script tag with data attributes.

```html
<script async src="https://cdn.roofcalc.com/widget.js" data-company-id="abc123"></script>
```

**Why script tag + Shadow DOM, not iframe:**
- Shadow DOM provides CSS isolation (host page styles cannot break widget, widget styles cannot leak out) with 96%+ browser support
- Script tag loads faster than iframe (no separate document context)
- Widget feels native to the host page, not like a foreign embed
- No cross-frame postMessage complexity for a simple form
- Bundle stays small (target: under 30KB gzipped with Preact)

**Why Preact over React:**
- Preact core is ~4.5KB vs React's ~40KB. For an embeddable widget on someone else's site, every kilobyte matters
- Same JSX/component model as React so the API is familiar
- Real-world Preact widget bundles land at 8-15KB gzipped; React equivalents are 35-45KB
- Preact's `preact/compat` layer is available if you need React-compatible library support later

**Shadow DOM setup pattern:**

```javascript
// widget entry point (IIFE bundle)
(function() {
  const script = document.currentScript;
  const companyId = script.dataset.companyId;

  // Create container
  const container = document.createElement('div');
  container.id = 'roofcalc-widget';
  script.parentNode.insertBefore(container, script.nextSibling);

  // Attach shadow for style isolation
  const shadow = container.attachShadow({ mode: 'open' });

  // Inject styles inside shadow
  const style = document.createElement('style');
  style.textContent = `/* widget CSS here, or load from CDN */`;
  shadow.appendChild(style);

  // Mount Preact app into shadow root
  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);
  render(h(App, { companyId }), mountPoint);
})();
```

**Build tooling:** Vite with Rollup output configured for IIFE format. Produces a single `widget.js` file. CSS is inlined into the JS bundle (injected into Shadow DOM at runtime) to keep the embed to a single request.

### 2. Backend API

**Framework: Hono** on Node.js (or deploy to Cloudflare Workers later).

Why Hono:
- Ultrafast, lightweight (~14KB), built for edge and Node
- First-class TypeScript
- Built-in CORS middleware
- Easy migration path to edge runtimes if needed later
- Simpler than Express for an API this small

**API surface (v1 -- intentionally minimal):**

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/config/:companyId` | GET | None (public) | Widget fetches branding + pricing params |
| `/api/estimates` | POST | None (public, rate-limited) | Submit estimate request, triggers email |
| `/api/admin/config` | GET | Session/token | Admin reads current config |
| `/api/admin/config` | PUT | Session/token | Admin updates config |
| `/api/admin/embed-code` | GET | Session/token | Returns embed snippet for copy/paste |

**CORS strategy:**

The widget runs on arbitrary customer domains. The API must allow cross-origin requests from any origin for the public widget endpoints (`/api/config/:companyId`, `/api/estimates`). This is safe because:
- These endpoints are read-only or write-only (no sensitive data returned)
- Rate limiting prevents abuse
- The companyId acts as a soft key (not a secret)

For admin endpoints, restrict CORS to the admin domain only.

```javascript
// Hono CORS middleware
app.use('/api/config/*', cors({ origin: '*' }));
app.use('/api/estimates', cors({ origin: '*' }));
app.use('/api/admin/*', cors({ origin: 'https://admin.roofcalc.com' }));
```

**Rate limiting:** Apply per-IP rate limiting on `/api/estimates` (e.g., 10 requests per minute) to prevent spam submissions. Use a simple in-memory store for v1, upgrade to Redis if needed.

### 3. Admin Settings Page

**Keep it simple.** This is a single-page settings form, not a dashboard. For v1, it needs exactly three sections:

1. **Branding:** Upload/paste logo URL, pick primary color
2. **Pricing:** Override default multipliers for pitch, complexity, and base cost per sqft
3. **Embed Code:** Copy-paste snippet with their company ID pre-filled

**Tech choice:** Build with the same Vite + Preact toolchain as the widget to keep the stack unified. Or use plain HTML + vanilla JS -- this page is simple enough that a framework is optional. Lean toward Preact for consistency.

**Authentication for v1:** Simple email/password auth with session cookies. Use a lightweight auth library or roll minimal auth (bcrypt + signed cookies). No OAuth, no magic links -- keep it dead simple. Consider upgrading to a proper auth solution (Lucia, Better Auth) only if you add more admin features later.

### 4. Database

**Recommendation: SQLite via Turso** for v1.

Why:
- Zero infrastructure to manage (Turso is hosted SQLite with an HTTP API)
- Perfect for the data volume (handful of companies, maybe hundreds of leads per day)
- SQL is familiar and the schema is trivial
- Turso supports edge replication if you move to Cloudflare Workers later
- Free tier is generous enough for early-stage SaaS

**Alternative:** PostgreSQL on Neon or Supabase if you prefer relational features or anticipate complex queries. But for v1, SQLite is simpler.

**Schema (v1):**

```sql
CREATE TABLE companies (
  id TEXT PRIMARY KEY,          -- UUID or nanoid
  name TEXT NOT NULL,
  email TEXT NOT NULL,           -- Where lead notifications go
  logo_url TEXT,
  primary_color TEXT DEFAULT '#2563eb',
  base_cost_per_sqft REAL DEFAULT 5.50,
  pitch_multiplier_low REAL DEFAULT 1.0,
  pitch_multiplier_medium REAL DEFAULT 1.15,
  pitch_multiplier_steep REAL DEFAULT 1.35,
  complexity_multiplier_simple REAL DEFAULT 1.0,
  complexity_multiplier_average REAL DEFAULT 1.15,
  complexity_multiplier_complex REAL DEFAULT 1.35,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL REFERENCES companies(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  address TEXT NOT NULL,
  sqft REAL NOT NULL,
  pitch TEXT NOT NULL,           -- 'flat', 'low', 'medium', 'steep'
  complexity TEXT NOT NULL,      -- 'simple', 'average', 'complex'
  estimate_low REAL NOT NULL,
  estimate_high REAL NOT NULL,
  consent_given INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
```

### 5. Email Delivery

**Recommendation: Resend.**

Why Resend over SendGrid or AWS SES:
- Developer-first API, simplest integration (single HTTP call)
- Modern SDK with TypeScript types
- Better deliverability defaults out of the box
- Free tier: 100 emails/day (plenty for early-stage)
- No separate "transactional vs marketing" pricing tiers like SendGrid

**Email flow:**

```
POST /api/estimates
  -> Calculate estimate
  -> Store lead in DB
  -> Call Resend API to send lead email to company
  -> Return estimate to widget
```

**Email template:** Simple HTML email with lead details. No complex templating engine needed -- use a string template or Resend's React email templates.

**Failure handling:** If email send fails, still return the estimate to the homeowner (don't block on email). Log the failure and implement a simple retry queue later if needed. The lead is already stored in the database, so it is not lost.

## Patterns to Follow

### Pattern 1: Config-at-Load, Not Config-at-Build
**What:** Widget fetches company config from the API at runtime, not baked into the JS bundle.
**When:** Always. Every company shares the same widget.js file.
**Why:** One JS file on the CDN serves all customers. Branding is applied dynamically. No per-customer builds.

```javascript
// Good: fetch config at runtime
const config = await fetch(`${API_URL}/api/config/${companyId}`);
const { logoUrl, primaryColor, pricing } = await config.json();

// Bad: build separate bundles per customer
// widget-abc123.js with hardcoded config
```

### Pattern 2: Optimistic UI with Background Email
**What:** Show the estimate to the homeowner immediately. Send email in the background.
**When:** On form submission.
**Why:** The homeowner should never wait for email delivery. The estimate display is instant feedback. Email delivery can take seconds.

### Pattern 3: Defensive Widget Loading
**What:** Widget must handle edge cases on host pages gracefully.
**When:** Always -- you do not control the host environment.

```javascript
// Wrap everything in try/catch
// Check for Shadow DOM support
// Fail silently rather than breaking host page
// Use 'all: initial' on shadow root to reset inherited styles
```

### Pattern 4: Company ID as Public Identifier
**What:** The company ID in the embed code is a public, non-secret identifier. It is not an API key.
**When:** Widget config lookup, estimate submission.
**Why:** Anyone can view-source the embed code. The company ID identifies which config to load but does not grant any write access to admin endpoints.

## Anti-Patterns to Avoid

### Anti-Pattern 1: iframe for a Simple Form Widget
**What:** Using an iframe to embed the calculator.
**Why bad:** Adds cross-origin postMessage complexity, fixed-height problems on mobile, slower load, feels disconnected from host page. iframes are appropriate for payment forms or authentication flows where bulletproof isolation is required -- not for a lead capture form.
**Instead:** Shadow DOM provides sufficient style isolation for this use case.

### Anti-Pattern 2: Per-Customer Widget Builds
**What:** Generating a separate JS bundle for each roofing company with their config baked in.
**Why bad:** Breaks CDN caching, requires a build pipeline per customer, slow onboarding.
**Instead:** Single universal widget.js that reads company ID from data attribute and fetches config at runtime.

### Anti-Pattern 3: Synchronous Widget Loading
**What:** Loading the widget script without `async` attribute.
**Why bad:** Blocks host page rendering. Roofing company sites are often WordPress/Wix with already-heavy page loads.
**Instead:** Always use `<script async>` and initialize only after DOM is ready.

### Anti-Pattern 4: Storing Secrets in Widget Code
**What:** Embedding API keys, email credentials, or admin tokens in the widget JS bundle.
**Why bad:** The widget runs on untrusted host pages. Any user can inspect the source.
**Instead:** Public-facing widget uses only the company ID (a public identifier). All sensitive operations (email sending, config updates) happen server-side behind authenticated admin endpoints.

## Scalability Considerations

| Concern | At 10 companies | At 100 companies | At 1,000 companies |
|---------|-----------------|-------------------|---------------------|
| Widget bundle | Single CDN file, no concern | Same file, CDN handles traffic | Same. CDN scales horizontally |
| Config API | Direct DB lookup | Add response caching (60s TTL) | Cache in Redis or edge KV store |
| Estimate submissions | In-memory rate limit | In-memory still fine | Redis-backed rate limiting |
| Email delivery | Resend free tier | Resend Pro ($20/mo) | Resend Business, monitor deliverability |
| Database | SQLite handles easily | SQLite still fine | Consider Postgres migration |
| Admin auth | Simple sessions | Simple sessions | Add proper auth provider |

## Suggested Build Order

The dependency chain dictates the build sequence:

### Phase 1: API + Database (foundation)
Build first because both frontends depend on it.
- Database schema and migrations
- Company config CRUD endpoints
- Estimate calculation logic
- Seed data for a test company

### Phase 2: Widget (core product)
Build second because this is the product. Requires API endpoints to exist.
- Script tag loader + Shadow DOM setup
- Multi-step form UI
- Config fetch and branding application
- Estimate submission and result display

### Phase 3: Email Delivery
Wire up after the widget can submit estimates. Requires API and leads table.
- Resend integration
- Lead notification email template
- Failure handling (log, don't block)

### Phase 4: Admin Settings Page
Build last because it is a supporting tool, not the product.
- Authentication (login/register)
- Branding settings form
- Pricing override form
- Embed code display with copy button

**Why this order:**
- The API is the dependency for everything else -- nothing works without it
- The widget is the product and the first thing to demo/validate
- Email delivery is the value delivery mechanism but can be wired in after the widget works
- Admin settings are needed for self-service but you can manually configure companies in the database during early testing

## Sources

- [Building Embeddable React Widgets: Production-Ready Guide](https://makerkit.dev/blog/tutorials/embeddable-widgets-react) -- script tag loader pattern, Shadow DOM, Rollup IIFE builds
- [Build an Embeddable Widget using Preact and the Shadow DOM](https://dev.to/companycam/build-an-embeddable-widget-using-preact-and-the-shadow-dom-33lm) -- Preact + Shadow DOM architecture, dual shadow root pattern
- [Preact or Svelte? An Embedded Widget Use Case - Sentry Engineering](https://sentry.engineering/blog/preact-or-svelte-an-embedded-widget-use-case/) -- framework comparison for widgets
- [Why Move Away From Iframe To Web Components](https://www.luzmo.com/blog/iframe-vs-web-component) -- iframe vs web component tradeoffs
- [CORS Guide - MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS) -- cross-origin resource sharing patterns
- [Email APIs in 2025: SendGrid vs Resend vs AWS SES](https://medium.com/@nermeennasim/email-apis-in-2025-sendgrid-vs-resend-vs-aws-ses-a-developers-journey-8db7b5545233) -- transactional email comparison
- [Embeddable Web Applications with Shadow DOM - Viget](https://www.viget.com/articles/embedable-web-applications-with-shadow-dom) -- Shadow DOM encapsulation patterns
