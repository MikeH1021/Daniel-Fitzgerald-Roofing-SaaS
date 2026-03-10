# Phase 4: Admin Settings - Research

**Researched:** 2026-03-10
**Domain:** Admin portal with authentication, file upload, and settings management on Cloudflare Workers + Hono
**Confidence:** HIGH

## Summary

Phase 4 delivers a self-service admin portal where roofing companies manage branding (logo, color), pricing overrides, and embed code. The existing codebase uses Hono on Cloudflare Workers with D1 (SQLite) and Drizzle ORM. The admin portal needs authentication (the key undecided research flag), logo file storage, and API routes for CRUD operations on company settings.

The simplest viable auth approach for v1 is password hashing with the Web Crypto API (available natively in Workers -- no bcrypt needed) combined with session tokens stored in D1 and delivered as httpOnly cookies. This avoids external dependencies while being secure. Logo images should be stored in Cloudflare R2 (S3-compatible object storage) with direct upload through the Worker (proxy pattern) since logos are small files. The admin UI should be a separate lightweight Preact page (reusing the existing Preact dependency from the widget package) served as a static HTML page.

**Primary recommendation:** Use PBKDF2 via Web Crypto API for password hashing, D1-backed session tokens with httpOnly cookies for auth, R2 for logo storage via Worker proxy upload, and a simple Preact SPA for the admin UI served from the Worker.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| ADMN-01 | Company can upload logo image | R2 storage via Worker proxy, logo URL stored in companies table (logoUrl column already exists) |
| ADMN-02 | Company can set primary brand color | PATCH endpoint on company settings, primaryColor column already exists in schema |
| ADMN-03 | Company can override default material costs and multipliers | CRUD on pricing_overrides table, schema already supports per-material costs and per-pitch multipliers |
| ADMN-04 | Company can view and copy embed code snippet | Read-only route that generates script tag with company ID, no new storage needed |
</phase_requirements>

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| hono | ^4.7.0 | API framework | Already used, has auth middleware built in |
| drizzle-orm | ^0.45.0 | Database ORM | Already used for D1 queries |
| zod | ^3.24.0 | Input validation | Already used for request schemas |
| preact | (from widget) | Admin UI rendering | Already a project dependency, tiny footprint |

### New Dependencies Required
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | - |

No new npm dependencies are needed. Password hashing uses the Web Crypto API (native to Workers runtime). Cookie helpers are built into Hono (`hono/cookie`). R2 is accessed via Worker binding (no SDK needed). The admin UI reuses Preact from the widget package.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Web Crypto PBKDF2 | better-auth library | Overkill for single-company-per-login v1; adds large dependency |
| D1 session tokens | JWT (stateless) | JWT cannot be revoked without a blocklist; D1 sessions are simpler and revocable |
| R2 via Worker proxy | Presigned URLs (client-direct) | Presigned URLs need aws4fetch package and more complex client code; logos are small (<1MB), proxy is fine |
| Preact admin page | React/Next.js | Massive overkill; Preact is already in the project |

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  routes/
    admin.ts          # Admin API routes (login, settings CRUD, logo upload)
    config.ts         # Existing public config route (unchanged)
    estimates.ts      # Existing estimates route (unchanged)
  middleware/
    auth.ts           # Session validation middleware
  auth/
    password.ts       # PBKDF2 hash/verify helpers
    session.ts        # Session create/validate/delete helpers
  db/
    schema.ts         # Add admin_sessions table
  index.ts            # Mount admin routes
packages/admin/       # OR packages/api/admin/ -- admin UI
  index.html          # Single page with Preact app
  src/
    App.tsx            # Admin SPA with login + settings forms
```

### Pattern 1: Password Hashing with Web Crypto API
**What:** Use PBKDF2 (available natively in Cloudflare Workers) instead of bcrypt (which requires Node.js native bindings not available in Workers).
**When to use:** Any password storage on Cloudflare Workers.
**Example:**
```typescript
// Source: Cloudflare Workers Web Crypto API docs
async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  // Store as: salt:hash (both base64)
  const saltB64 = btoa(String.fromCharCode(...salt));
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return `${saltB64}:${hashB64}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, expectedHashB64] = stored.split(':');
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashB64 = btoa(String.fromCharCode(...new Uint8Array(hash)));
  return hashB64 === expectedHashB64;
}
```

### Pattern 2: Session Token with httpOnly Cookie
**What:** Generate a random session token on login, store it in D1 with expiry, set as httpOnly cookie.
**When to use:** Admin authentication flow.
**Example:**
```typescript
// Source: Hono cookie helper docs (hono.dev/docs/helpers/cookie)
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';
import { nanoid } from 'nanoid';

// On login success:
const sessionToken = nanoid(32);
await db.insert(adminSessions).values({
  id: sessionToken,
  companyId: company.id,
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
});
setCookie(c, 'session', sessionToken, {
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
  path: '/',
  maxAge: 7 * 24 * 60 * 60, // 7 days
});
```

### Pattern 3: R2 Logo Upload via Worker Proxy
**What:** Admin form sends logo file to Worker, Worker stores in R2, returns public URL.
**When to use:** Logo upload (ADMN-01).
**Example:**
```typescript
// Source: Cloudflare R2 Workers API docs
// wrangler.toml addition:
// [[r2_buckets]]
// binding = "LOGOS_BUCKET"
// bucket_name = "roofing-logos"

// Route handler:
admin.post('/logo', authMiddleware, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('logo') as File;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  // Validate file type and size
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: 'Invalid file type' }, 400);
  }
  if (file.size > 1024 * 1024) { // 1MB limit
    return c.json({ error: 'File too large (max 1MB)' }, 400);
  }

  const key = `${companyId}/logo${getExtension(file.type)}`;
  await c.env.LOGOS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  // Store the public URL in D1
  const logoUrl = `https://logos.your-domain.com/${key}`;
  await db.update(companies)
    .set({ logoUrl, updatedAt: new Date().toISOString() })
    .where(eq(companies.id, companyId));

  return c.json({ logoUrl });
});
```

### Pattern 4: Auth Middleware for Protected Routes
**What:** Hono middleware that validates session cookie before allowing access to admin routes.
**When to use:** All admin API routes except login.
**Example:**
```typescript
import { getCookie } from 'hono/cookie';
import { createMiddleware } from 'hono/factory';

const authMiddleware = createMiddleware<{ Bindings: Bindings }>(async (c, next) => {
  const sessionToken = getCookie(c, 'session');
  if (!sessionToken) return c.json({ error: 'Unauthorized' }, 401);

  const db = createDb(c.env.DB);
  const sessions = await db.select()
    .from(adminSessions)
    .where(eq(adminSessions.id, sessionToken));

  if (sessions.length === 0) return c.json({ error: 'Unauthorized' }, 401);

  const session = sessions[0];
  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(adminSessions).where(eq(adminSessions.id, sessionToken));
    return c.json({ error: 'Session expired' }, 401);
  }

  // Attach companyId to context for downstream handlers
  c.set('companyId', session.companyId);
  await next();
});
```

### Anti-Patterns to Avoid
- **Storing passwords in plaintext or with MD5/SHA alone:** Use PBKDF2 with salt and sufficient iterations.
- **Using localStorage for session tokens:** httpOnly cookies prevent XSS token theft.
- **Exposing R2 bucket directly to the internet without access control:** Always proxy through the Worker or use presigned URLs.
- **Building a full SPA router for the admin page:** A single-page form with conditional rendering is sufficient for 4 settings screens.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash function | Web Crypto PBKDF2 (native) | Cryptographically vetted, no dependencies |
| Cookie management | Manual Set-Cookie headers | `hono/cookie` helpers | Handles encoding, options, deletion correctly |
| Input validation | Manual checks | Zod schemas (already in project) | Consistent with existing patterns, type inference |
| File type validation | Reading magic bytes | Check Content-Type + file extension | Sufficient for logos; magic byte checking is overkill for v1 |
| Color picker UI | Custom color input | HTML `<input type="color">` | Native browser support, zero JS needed |

**Key insight:** The admin panel is a simple CRUD interface for 4 settings. Resist the urge to over-engineer it with complex frameworks or libraries.

## Common Pitfalls

### Pitfall 1: bcrypt Does Not Work in Cloudflare Workers
**What goes wrong:** Importing bcrypt or bcryptjs fails at runtime because Workers lack Node.js native bindings.
**Why it happens:** Workers use V8 isolates, not Node.js. Even bcryptjs (pure JS) may have issues with Workers' restricted environment.
**How to avoid:** Use Web Crypto API's PBKDF2, which is natively available in all Workers.
**Warning signs:** Build succeeds but runtime errors about missing crypto or buffer modules.

### Pitfall 2: CORS for Admin UI on Different Origin
**What goes wrong:** Admin page on a different subdomain or port cannot reach admin API routes.
**Why it happens:** Browser CORS policy blocks cross-origin requests.
**How to avoid:** Either serve admin HTML from the same Worker (same origin) or add CORS headers specifically for the admin origin. Serving from the same Worker is simpler.
**Warning signs:** 403/CORS errors in browser console during development.

### Pitfall 3: Cookie Not Sent on Cross-Origin Requests
**What goes wrong:** httpOnly cookie set by the API is not included in subsequent requests from admin UI.
**Why it happens:** If admin UI and API are on different origins, cookies require `sameSite: 'None'` and `secure: true`, plus `credentials: 'include'` on fetch calls.
**How to avoid:** Serve admin UI from the same Worker/origin as the API. This eliminates cross-origin cookie issues entirely.
**Warning signs:** Login succeeds but all subsequent requests return 401.

### Pitfall 4: R2 Public Access Configuration
**What goes wrong:** Uploaded logos cannot be loaded by the widget because the R2 bucket is not publicly accessible.
**Why it happens:** R2 buckets are private by default. Public access must be explicitly enabled or content must be served through a Worker.
**How to avoid:** Either enable R2 public bucket access with a custom domain, or add a public route in the Worker that serves logo images from R2 (e.g., `GET /api/logos/:companyId`).
**Warning signs:** Logo URL returns 403 when loaded by the widget.

### Pitfall 5: FormData File Handling in Workers
**What goes wrong:** `request.formData()` consumes the request body, causing issues if accessed multiple times.
**Why it happens:** Request bodies are streams that can only be consumed once.
**How to avoid:** Call `formData()` only once and destructure all needed fields from the result.
**Warning signs:** TypeError about body already consumed.

## Code Examples

### Admin Login Endpoint
```typescript
// Source: Pattern derived from Hono docs + Web Crypto API
admin.post('/login', async (c) => {
  const { email, password } = await c.req.json();
  const db = createDb(c.env.DB);

  const results = await db.select()
    .from(companies)
    .where(eq(companies.email, email));

  if (results.length === 0) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const company = results[0];
  const valid = await verifyPassword(password, company.passwordHash);
  if (!valid) return c.json({ error: 'Invalid credentials' }, 401);

  // Create session
  const token = nanoid(32);
  await db.insert(adminSessions).values({
    id: token,
    companyId: company.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });

  setCookie(c, 'session', token, {
    httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 604800,
  });

  return c.json({ companyId: company.id, name: company.name });
});
```

### Settings Update Endpoint
```typescript
admin.patch('/settings', authMiddleware, async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const db = createDb(c.env.DB);

  // Validate with zod
  const schema = z.object({
    primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  });
  const parsed = schema.parse(body);

  await db.update(companies)
    .set({ ...parsed, updatedAt: new Date().toISOString() })
    .where(eq(companies.id, companyId));

  return c.json({ success: true });
});
```

### Pricing Overrides Update Endpoint
```typescript
admin.put('/pricing', authMiddleware, async (c) => {
  const companyId = c.get('companyId');
  const body = await c.req.json();
  const db = createDb(c.env.DB);

  // Schema matches existing pricing_overrides table structure
  const overrideSchema = z.object({
    materialKey: z.enum(['3-tab', 'architectural', 'standing-seam-metal']),
    costLow: z.number().positive().optional(),
    costHigh: z.number().positive().optional(),
    pitchFlat: z.number().positive().optional(),
    pitchLow: z.number().positive().optional(),
    pitchMedium: z.number().positive().optional(),
    pitchSteep: z.number().positive().optional(),
  });
  const overridesSchema = z.array(overrideSchema);
  const overrides = overridesSchema.parse(body);

  // Delete existing overrides for this company, then insert new ones
  await db.delete(pricingOverrides)
    .where(eq(pricingOverrides.companyId, companyId));

  for (const override of overrides) {
    await db.insert(pricingOverrides).values({
      id: nanoid(),
      companyId,
      ...override,
    });
  }

  return c.json({ success: true, count: overrides.length });
});
```

### Embed Code Generation
```typescript
admin.get('/embed-code', authMiddleware, async (c) => {
  const companyId = c.get('companyId');
  // API_BASE should be derived from the request origin or an env var
  const apiBase = c.env.API_BASE_URL || new URL(c.req.url).origin;
  const snippet = `<script src="${apiBase}/widget/roofing-widget.js" data-company-id="${companyId}"></script>`;
  return c.json({ embedCode: snippet });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt in Workers | Web Crypto PBKDF2 | Always (Workers never supported bcrypt) | Must use native crypto |
| JWT for sessions | D1-backed session tokens | N/A (project decision) | Simpler, revocable sessions |
| Separate admin app | Same-origin Worker-served admin | N/A (project decision) | Eliminates CORS/cookie issues |

**Deprecated/outdated:**
- bcrypt/bcryptjs: Not viable in Cloudflare Workers runtime.

## DB Schema Changes Required

The existing schema needs two additions:

1. **`password_hash` column on `companies` table** -- stores PBKDF2 hash for admin login
2. **`admin_sessions` table** -- stores session tokens with expiry

```typescript
// New table
export const adminSessions = sqliteTable('admin_sessions', {
  id: text('id').primaryKey(), // session token (nanoid)
  companyId: text('company_id').notNull().references(() => companies.id),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').default("(datetime('now'))"),
});

// Add to companies table (via migration):
// ALTER TABLE companies ADD COLUMN password_hash TEXT;
```

## R2 Configuration Required

Add to `wrangler.toml`:
```toml
[[r2_buckets]]
binding = "LOGOS_BUCKET"
bucket_name = "roofing-logos"
```

Add to `Bindings` type:
```typescript
export type Bindings = {
  DB: D1Database;
  LOGOS_BUCKET: R2Bucket;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  API_BASE_URL?: string;
  ESTIMATE_RATE_LIMITER?: RateLimit;
};
```

## Open Questions

1. **How to serve admin UI HTML**
   - What we know: The widget is served as a JS file from the Worker. Admin needs a full HTML page.
   - What's unclear: Whether to serve a static HTML file from the Worker (using Hono's `serveStatic` or inline HTML) or build a separate admin package.
   - Recommendation: Serve admin HTML inline from a Hono route (e.g., `GET /admin`) with the Preact app bundled. Simplest approach for v1 with zero deployment complexity.

2. **R2 public access for logo serving**
   - What we know: R2 buckets are private by default. Logos need to be publicly accessible for the widget.
   - What's unclear: Whether to use R2 custom domain (public bucket) or serve through the Worker.
   - Recommendation: Serve through a public Worker route (`GET /api/logos/:key`) that reads from R2. Avoids R2 public bucket setup and keeps everything in one Worker.

3. **Initial company password setup**
   - What we know: Companies need passwords to log in, but the current seed script has no password.
   - What's unclear: Whether to build a registration flow or seed passwords manually.
   - Recommendation: For v1, add a `POST /api/admin/setup` one-time endpoint that sets the initial password if `password_hash` is null. No registration flow needed -- companies are created manually.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ~2.1.0 with @cloudflare/vitest-pool-workers |
| Config file | packages/api/vitest.config.ts (exists) |
| Quick run command | `cd packages/api && npx vitest run` |
| Full suite command | `cd packages/api && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMN-01 | Logo upload stores in R2 and updates company logoUrl | integration | `cd packages/api && npx vitest run src/__tests__/admin.test.ts -t "logo"` | No -- Wave 0 |
| ADMN-02 | Brand color update persists to D1 and returns in config | integration | `cd packages/api && npx vitest run src/__tests__/admin.test.ts -t "color"` | No -- Wave 0 |
| ADMN-03 | Pricing override CRUD updates pricing_overrides table | integration | `cd packages/api && npx vitest run src/__tests__/admin.test.ts -t "pricing"` | No -- Wave 0 |
| ADMN-04 | Embed code endpoint returns correct script tag | unit | `cd packages/api && npx vitest run src/__tests__/admin.test.ts -t "embed"` | No -- Wave 0 |
| AUTH | Login returns session cookie, protected routes reject without it | integration | `cd packages/api && npx vitest run src/__tests__/admin.test.ts -t "auth"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run`
- **Per wave merge:** `cd packages/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/src/__tests__/admin.test.ts` -- covers ADMN-01 through ADMN-04 and auth
- [ ] R2 bucket mock setup in test config (vitest-pool-workers supports R2 bindings in miniflare)

## Sources

### Primary (HIGH confidence)
- Cloudflare R2 Workers API Reference (https://developers.cloudflare.com/r2/api/workers/workers-api-reference/) -- R2 put/get/delete signatures and R2Object type
- Hono Cookie Helper docs (https://hono.dev/docs/helpers/cookie) -- setCookie, getCookie, deleteCookie API
- Hono Bearer Auth Middleware (https://hono.dev/docs/middleware/builtin/bearer-auth) -- middleware patterns
- Cloudflare R2 Upload docs (https://developers.cloudflare.com/r2/objects/upload-objects/) -- upload methods

### Secondary (MEDIUM confidence)
- Hono session discussions (https://github.com/orgs/honojs/discussions/2434) -- cookie session patterns on Workers
- Liran Tal R2 presigned URL guide (https://lirantal.com/blog/cloudflare-r2-presigned-url-uploads-hono) -- Hono + R2 integration patterns
- Massadas D1 auth tutorial (https://massadas.com/posts/implementing-register-and-login-in-workers-d1/) -- D1-based login flow

### Tertiary (LOW confidence)
- Web Crypto PBKDF2 usage in Workers -- verified by multiple community sources but no single authoritative Cloudflare tutorial

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already in the project, no new dependencies
- Architecture: HIGH -- patterns follow existing codebase conventions (Hono routes, Drizzle schema, Zod validation)
- Auth approach: HIGH -- PBKDF2 via Web Crypto is the documented approach for Workers; D1 sessions follow established patterns
- R2 integration: MEDIUM -- API is well-documented but R2 mocking in vitest-pool-workers needs verification during implementation
- Pitfalls: HIGH -- well-known issues with Workers runtime constraints

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, unlikely to change)
