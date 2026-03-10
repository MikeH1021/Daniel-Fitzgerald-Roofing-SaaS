# Phase 3: Lead Delivery - Research

**Researched:** 2026-03-10
**Domain:** Transactional email delivery, bot protection, Cloudflare Workers
**Confidence:** HIGH

## Summary

Phase 3 adds email notifications to roofing companies when a lead is captured, plus bot protection to keep lead quality high. The existing estimate POST endpoint already stores leads in D1 with all required fields (name, email, phone, roof details, estimate). This phase extends that flow to fire off an email and adds honeypot + rate limiting to block bots.

The email sending approach is straightforward: use Resend via its HTTP API (or lightweight SDK) from the existing Cloudflare Worker. Resend is the recommended choice because it has first-class edge runtime support, Cloudflare has an official tutorial for it, the free tier covers 3,000 emails/month (sufficient for v1), and it handles SPF/DKIM/DMARC setup to ensure inbox delivery. Bot protection uses two layers: a hidden honeypot field in the widget form (zero user friction) and Cloudflare Workers Rate Limiting binding (native, no external dependency).

**Primary recommendation:** Use Resend for email delivery via direct `fetch()` calls (no SDK needed), add a honeypot hidden field to the widget, and use Cloudflare Workers native Rate Limiting binding for rate limiting. This keeps the dependency footprint minimal and stays within the Cloudflare ecosystem.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEAD-03 | Roofing company receives email with all lead details and estimate shown within 1 minute of submission | Resend API delivers email synchronously within the estimate POST handler; typical delivery is under 5 seconds. Email template includes all lead fields from the existing `leads` table schema. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Resend (HTTP API) | v2 API | Transactional email sending | Official Cloudflare Workers tutorial, edge-compatible, handles SPF/DKIM, generous free tier (3K/mo) |
| CF Workers Rate Limiting | native binding | Per-IP or per-companyId rate limiting | Zero-dependency, native CF binding, no external service needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none) | - | - | No additional libraries needed. Resend is called via `fetch()`, rate limiting is a CF binding, honeypot is pure logic. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Resend | SendGrid | SendGrid SDK is Node.js-only, incompatible with Workers edge runtime. Raw HTTP works but SendGrid's free tier is more restrictive and requires more DNS config. |
| Resend | Cloudflare Email Service | Still in private beta (announced Sep 2025). Not GA. Cannot depend on it for v1. |
| Resend | AWS SES | More complex setup, IAM credentials management, no edge-native SDK. Overkill for v1 volume. |
| CF Rate Limiting binding | @hono-rate-limiter/cloudflare | Adds npm dependency for something achievable with 5 lines of native binding code. |

**Installation:**
```bash
# No npm packages needed -- Resend is called via fetch(), rate limiting is a CF binding
# Only wrangler.toml changes required for rate limiting binding
```

## Architecture Patterns

### Recommended Project Structure
```
packages/api/src/
  routes/
    estimates.ts          # Extended: add email send after lead insert
  email/
    send-lead-notification.ts   # Resend fetch() call + HTML template
    lead-email-template.ts      # HTML email builder function
  validation/
    schemas.ts            # Extended: add honeypot field
```

```
packages/widget/src/
  components/
    ContactStep.tsx       # Extended: add hidden honeypot field
```

### Pattern 1: Fire-and-Forget Email with Error Isolation
**What:** Send the email after lead insert but do NOT fail the estimate response if email fails. Use `ctx.waitUntil()` for async email send so the response returns immediately.
**When to use:** Always -- the homeowner should see their estimate even if email delivery has a transient error.
**Example:**
```typescript
// In estimates.ts route handler, after lead insert:
// Use waitUntil so email sends after response is returned
ctx.waitUntil(
  sendLeadNotification(env.RESEND_API_KEY, {
    to: companyEmail,
    lead: { firstName, lastName, email, phone, sqft, pitch, material, estimateLow, estimateHigh },
    companyName,
  }).catch((err) => {
    console.error('Lead notification email failed:', err);
  })
);

return c.json({ ...result, configSource });
```

### Pattern 2: Resend via fetch() (No SDK)
**What:** Call Resend's REST API directly with `fetch()` instead of installing the npm package.
**When to use:** Always in Cloudflare Workers -- avoids adding a dependency for a single POST request.
**Example:**
```typescript
// Source: https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/
async function sendEmail(apiKey: string, options: {
  from: string; to: string; subject: string; html: string;
}) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: options.from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
  return res.json();
}
```

### Pattern 3: Honeypot Hidden Field
**What:** Add a hidden text field to the form that is invisible to humans but filled by bots. Reject submissions where it has a value.
**When to use:** Always as the first layer of bot defense.
**Example:**
```typescript
// In validation schema -- add honeypot field
const estimateRequestSchema = z.object({
  // ... existing fields ...
  website: z.string().max(0, 'Bot detected').optional().default(''),
  // "website" is a honeypot: hidden in UI, bots fill it
});

// In route handler -- reject if honeypot is filled
if (validated.website) {
  // Silently return a fake success to not tip off bots
  return c.json({ estimateLow: 0, estimateHigh: 0, disclaimer: '', configSource: 'default' });
}
```

### Pattern 4: Rate Limiting with CF Binding
**What:** Use the native Cloudflare Workers Rate Limiting binding to throttle estimate submissions per IP.
**When to use:** On the POST /api/estimates endpoint to prevent abuse.
**Example:**
```typescript
// In wrangler.toml:
// [[ratelimits]]
// name = "ESTIMATE_RATE_LIMITER"
// namespace_id = "1001"
//   [ratelimits.simple]
//   limit = 10
//   period = 60

// In route handler:
const clientIP = c.req.header('cf-connecting-ip') || 'unknown';
const { success } = await c.env.ESTIMATE_RATE_LIMITER.limit({ key: clientIP });
if (!success) {
  return c.json({ error: 'Too many requests. Please try again later.' }, 429);
}
```

### Anti-Patterns to Avoid
- **Blocking response on email delivery:** Never await the email send in the main response path. Use `ctx.waitUntil()` or fire-and-forget so the user gets their estimate instantly.
- **Installing Resend SDK:** The SDK adds unnecessary dependency weight for a single `fetch()` call. Use raw HTTP.
- **Using IP addresses as the only rate limit key:** CF docs explicitly warn against this due to shared IPs on mobile/proxy networks. Use IP + companyId combination for better accuracy.
- **Returning error on honeypot detection:** Bots learn from errors. Return a fake success (200) with dummy data to avoid tipping off bots.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Email delivery + inbox placement | Custom SMTP client, raw email headers | Resend API | SPF/DKIM/DMARC handled automatically, deliverability reputation managed by provider |
| Rate limiting | In-memory counters, D1-based counters | CF Workers Rate Limiting binding | Native binding, no cold-start penalty, per-location enforcement, handles edge cases |
| HTML email templates | String concatenation with manual escaping | Template literal function with pre-escaped values | Prevents XSS in email content, ensures consistent rendering |
| Bot detection | CAPTCHA integration | Honeypot field + rate limiting | Zero user friction, no third-party JS, handles 95%+ of automated bots |

**Key insight:** Email deliverability is a solved problem -- use a provider. Trying to send email directly from Workers via SMTP or raw protocols leads to spam folder placement and maintenance burden.

## Common Pitfalls

### Pitfall 1: Email Lands in Spam
**What goes wrong:** Notification emails are flagged as spam by Gmail/Outlook/Yahoo.
**Why it happens:** Missing or misconfigured SPF, DKIM, or DMARC records. Sending from a generic or unverified domain.
**How to avoid:** (1) Verify the sending domain in Resend dashboard, which auto-configures DNS records. (2) Use a subdomain like `notifications.yourdomain.com` to isolate reputation. (3) Set DMARC policy. (4) Use a descriptive "from" name like "Acme Roofing Lead Alert" not "noreply".
**Warning signs:** Test emails going to spam/junk folder during development.

### Pitfall 2: waitUntil Not Available in Hono Context
**What goes wrong:** `c.executionCtx.waitUntil()` is not directly available in Hono's context object.
**Why it happens:** Hono wraps the raw Workers execution context.
**How to avoid:** Access it via `c.executionCtx.waitUntil()` -- Hono exposes the raw execution context on the Hono context object.
**Warning signs:** Email never sends, no errors logged.

### Pitfall 3: Rate Limiting is Per-Location, Not Global
**What goes wrong:** A distributed bot attack from different regions bypasses rate limits.
**Why it happens:** CF Workers Rate Limiting binding enforces limits per Cloudflare edge location, not globally.
**How to avoid:** Accept this as a reasonable tradeoff for v1. The honeypot catches most bots regardless. For v1 volume levels, per-location limiting is sufficient.
**Warning signs:** High lead volume from geographically distributed sources.

### Pitfall 4: Leaking Resend API Key
**What goes wrong:** API key committed to source code or wrangler.toml.
**Why it happens:** Developer puts key in config instead of using Workers secrets.
**How to avoid:** Store as a Worker secret via `wrangler secret put RESEND_API_KEY`. Access via `env.RESEND_API_KEY`. Use `.dev.vars` for local development (already in .gitignore).
**Warning signs:** API key visible in git history.

### Pitfall 5: Honeypot Field Visible to Screen Readers
**What goes wrong:** Accessibility tools announce the honeypot field, confusing real users.
**Why it happens:** Using `display:none` or `visibility:hidden` alone -- some bots detect these.
**How to avoid:** Use `aria-hidden="true"`, `tabindex="-1"`, position the field off-screen with CSS (`position:absolute; left:-9999px`), and add `autocomplete="off"` to prevent browsers from filling it.
**Warning signs:** Legitimate submissions being rejected.

## Code Examples

### Lead Notification Email Template
```typescript
// Source: project-specific pattern
interface LeadEmailData {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  sqft: number;
  pitch: string;
  material: string;
  estimateLow: number;
  estimateHigh: number;
}

function buildLeadEmailHtml(data: LeadEmailData): string {
  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">New Roofing Lead</h2>
      <p>A homeowner just requested an estimate on your website.</p>

      <h3 style="color: #333;">Contact Information</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Name</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><a href="mailto:${escapeHtml(data.email)}">${escapeHtml(data.email)}</a></td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Phone</td>
            <td style="padding: 8px; border: 1px solid #ddd;"><a href="tel:${escapeHtml(data.phone)}">${escapeHtml(data.phone)}</a></td></tr>
      </table>

      <h3 style="color: #333;">Roof Details</h3>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Square Footage</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${data.sqft} sq ft</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Pitch</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(data.pitch)}</td></tr>
        <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Material</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(data.material)}</td></tr>
      </table>

      <h3 style="color: #333;">Estimate Shown</h3>
      <p style="font-size: 18px; font-weight: bold; color: #2563eb;">
        ${formatCurrency(data.estimateLow)} - ${formatCurrency(data.estimateHigh)}
      </p>

      <p style="color: #666; font-size: 12px; margin-top: 24px;">
        This lead was generated by your roofing estimate widget.
      </p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
```

### Wrangler Config for Rate Limiting
```toml
# Add to wrangler.toml
[[ratelimits]]
name = "ESTIMATE_RATE_LIMITER"
namespace_id = "1001"

  [ratelimits.simple]
  limit = 10
  period = 60
```

### Updated Bindings Type
```typescript
// Update types.ts
export type Bindings = {
  DB: D1Database;
  RESEND_API_KEY: string;
  ESTIMATE_RATE_LIMITER: RateLimit;
};
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| MailChannels (free via CF Workers) | Resend / other paid API | MailChannels ended free CF partnership Feb 2024 | Must use paid email API provider |
| CAPTCHA for bot protection | Honeypot + rate limiting | Ongoing trend | Zero user friction, comparable bot blocking for form submissions |
| Install email SDK | Direct fetch() to API | Edge runtime adoption | Fewer dependencies, smaller bundle, no Node.js compatibility issues |

**Deprecated/outdated:**
- MailChannels free tier for CF Workers: ended Feb 2024, no longer available
- Cloudflare Email Service: announced Sep 2025, still private beta -- not production-ready

## Open Questions

1. **Resend sending domain**
   - What we know: Resend requires a verified domain for sending. The project likely has a domain for the API.
   - What's unclear: Which domain/subdomain to use for sending notification emails.
   - Recommendation: Use a subdomain like `leads.{projectdomain}.com` or let the implementer configure via Resend dashboard. Store the "from" address as an environment variable.

2. **Company notification email source**
   - What we know: The `companies` table has an `email` column that stores the company's email address.
   - What's unclear: Nothing -- the email column already exists and is populated.
   - Recommendation: Use `companies.email` as the `to` address for lead notifications. Already available in the estimate route where company lookup occurs.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest ~2.1.x with @cloudflare/vitest-pool-workers |
| Config file | `packages/api/vitest.config.ts` |
| Quick run command | `cd packages/api && npx vitest run` |
| Full suite command | `cd packages/api && npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LEAD-03a | Email sent with correct lead details after submission | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "sends email"` | No -- Wave 0 |
| LEAD-03b | Email contains homeowner name, email, phone, roof details, estimate | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "email content"` | No -- Wave 0 |
| LEAD-03c | Honeypot field rejects bot submissions silently | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "honeypot"` | No -- Wave 0 |
| LEAD-03d | Rate limiting returns 429 on excessive requests | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "rate limit"` | No -- Wave 0 |
| LEAD-03e | Estimate response still returns when email send fails | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "email failure"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run`
- **Per wave merge:** `cd packages/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/test/lead-notification.test.ts` -- covers LEAD-03a, LEAD-03b, LEAD-03e (email sending with mocked Resend API)
- [ ] Honeypot and rate limiting tests added to existing `test/estimates.test.ts` -- covers LEAD-03c, LEAD-03d
- [ ] Mock/stub for Resend API fetch calls and RateLimit binding in test setup

## Sources

### Primary (HIGH confidence)
- [Cloudflare Workers: Send Emails with Resend](https://developers.cloudflare.com/workers/tutorials/send-emails-with-resend/) -- official tutorial, code patterns verified
- [Cloudflare Workers Rate Limiting API](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) -- binding config, TypeScript types, usage patterns
- Existing codebase: `packages/api/src/routes/estimates.ts`, `packages/api/src/db/schema.ts` -- verified leads table schema, company email field, route structure

### Secondary (MEDIUM confidence)
- [Resend pricing](https://resend.com/pricing) -- free tier 3K emails/month confirmed via multiple sources
- [Resend Cloudflare Workers docs](https://resend.com/docs/send-with-cloudflare-workers) -- SDK and direct API usage

### Tertiary (LOW confidence)
- Cloudflare Email Service beta status -- announced Sep 2025, beta timeline unclear, not relied upon

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Resend has official CF tutorial, Rate Limiting is native CF binding
- Architecture: HIGH - extending existing route with well-documented patterns (waitUntil, fetch API)
- Pitfalls: HIGH - spam/deliverability, honeypot accessibility, and rate limiting locality are well-documented concerns

**Research date:** 2026-03-10
**Valid until:** 2026-04-10 (stable domain, established APIs)
