# Phase 7: Lead Email Integration - Research

**Researched:** 2026-03-16
**Domain:** Widget-to-API data flow, email template extension, DB schema migration
**Confidence:** HIGH

## Summary

Phase 7 has a single requirement: when a homeowner uses map mode and selects an address via autocomplete, the property address must appear in the roofing company's lead notification email. When manual entry is used (no address selected), the email must be unchanged from v1.0.

The address is already captured client-side in the `selectedPlace` signal (`state/map.ts`) as `formattedAddress`. The only work is threading it through four layers: (1) widget form state / API call, (2) Zod validation schema, (3) API route handler + DB insert, and (4) email template. The `leads` DB table needs an optional `address` column added via migration. The email template adds a conditional "Property Address" row that renders only when the address is present.

No new libraries are needed. No architectural changes are required. This is a pure data-threading exercise across existing code.

**Primary recommendation:** Add `address?: string` as an optional field through the entire stack — widget signal to API submit, schema validation, DB insert, and email template. Conditional rendering at each layer ensures backward compatibility with manual-entry submissions.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LEAD-01 | Property address from autocomplete is included in lead notification email | `selectedPlace.formattedAddress` in `state/map.ts` is the address source. Threading it through widget → API → DB → email template requires changes to 5 files: `client.ts`, `schemas.ts`, `estimates.ts`, DB schema + migration, `lead-email-template.ts`. Conditional logic at each layer preserves manual-entry behavior. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (no new libraries) | — | All needed capabilities exist in the codebase | Address is a plain string; existing Zod, Drizzle, and template literal infrastructure handles it |

### Data Flow Overview

The address travels through the following layers, each requiring a small change:

| Layer | File | Change |
|-------|------|--------|
| Map state | `packages/widget/src/state/map.ts` | Already has `selectedPlace.formattedAddress` — no change needed |
| API client | `packages/widget/src/api/client.ts` | Add `address?: string` to `submitEstimate` payload |
| Widget submit | `packages/widget/src/components/ContactInfo.tsx` | Read `selectedPlace.value?.formattedAddress` and include in API call |
| Validation | `packages/api/src/validation/schemas.ts` | Add `address: z.string().max(500).optional()` |
| Route handler | `packages/api/src/routes/estimates.ts` | Pass `address` to DB insert and email data |
| DB schema | `packages/api/src/db/schema.ts` | Add `address text` nullable column to `leads` table |
| DB migration | `packages/api/migrations/` | Add `ALTER TABLE leads ADD COLUMN address text;` |
| Email template | `packages/api/src/email/lead-email-template.ts` | Add optional `address?` to `LeadEmailData`, conditional row in HTML |

## Architecture Patterns

### Recommended Project Structure

No new directories needed. All changes are in-place modifications to existing files.

```
packages/widget/src/
  api/client.ts                    # Add address? to submitEstimate params
  components/ContactInfo.tsx       # Read selectedPlace, pass address to API

packages/api/src/
  validation/schemas.ts            # Add address? field
  routes/estimates.ts              # Pass address to DB insert + email
  db/schema.ts                     # Add address column to leads table
  email/lead-email-template.ts     # Add address? to LeadEmailData + HTML row

packages/api/migrations/
  XXXX_add_address_to_leads.sql    # ALTER TABLE migration
```

### Pattern 1: Optional Field Threading (address? through all layers)

**What:** Add `address?: string` as optional at every layer. Undefined/null means manual entry — no rendering change. Present means map mode was used — show address.

**When to use:** Any time a new optional field must flow from widget to email without breaking existing behavior.

**Widget side — read from map signal:**
```typescript
// In ContactInfo.tsx handleSubmit, after existing fields:
// Source: existing pattern from state/map.ts selectedPlace signal
import { selectedPlace } from '../state/map';

const result = await submitEstimate({
  sqft: Number(data.sqft),
  pitch: data.pitch,
  material: data.material,
  companyId,
  firstName: data.firstName,
  lastName: data.lastName,
  email: data.email,
  phone: data.phone,
  consent: data.consent,
  // Only include address if map mode produced a selection
  address: selectedPlace.value?.formattedAddress || undefined,
});
```

**API client — add optional param:**
```typescript
// In client.ts submitEstimate signature:
export async function submitEstimate(data: {
  sqft: number;
  pitch: string;
  material: string;
  companyId: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
  website?: string;
  address?: string;   // NEW: property address from map mode autocomplete
}): Promise<...>
```

**Schema validation — optional, capped length:**
```typescript
// In schemas.ts estimateRequestSchema:
address: z.string().max(500).optional(),
```

**DB schema — nullable column:**
```typescript
// In schema.ts leads table:
address: text('address'),   // nullable — absent for manual entry
```

**DB migration:**
```sql
-- New migration file: packages/api/migrations/XXXX_add_address_to_leads.sql
ALTER TABLE leads ADD COLUMN address text;
```

**Route handler — pass to insert and email:**
```typescript
// In estimates.ts, inside the lead storage block:
await db.insert(leads).values({
  id: nanoid(),
  companyId,
  firstName: validated.firstName,
  lastName: validated.lastName,
  email: validated.email,
  phone: validated.phone,
  consentGiven: true,
  consentText,
  sqft,
  pitch,
  material,
  estimateLow: result.estimateLow,
  estimateHigh: result.estimateHigh,
  address: validated.address || null,   // NEW
});

// In the sendLeadNotification call, add address to lead object:
lead: {
  // ...existing fields...
  address: validated.address,   // NEW: undefined when not in map mode
},
```

**Email template — conditional row:**
```typescript
// In lead-email-template.ts LeadEmailData:
export interface LeadEmailData {
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
  address?: string;   // NEW: present only for map mode submissions
}

// In buildLeadEmailHtml, add conditional row to Contact Information table:
${data.address ? `
  <tr>
    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 120px;">Property Address</td>
    <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(data.address)}</td>
  </tr>` : ''}
```

### Pattern 2: Drizzle Migration for Nullable Column Addition

**What:** Add a nullable `text` column to an existing table using a SQL migration file.

**When to use:** Any time the D1/SQLite schema needs a backward-compatible column addition.

**Important:** SQLite `ALTER TABLE ... ADD COLUMN` only supports adding nullable columns (or columns with a default). Since `address` is optional, this is fine.

```sql
-- Migration file contents:
ALTER TABLE leads ADD COLUMN address text;
```

Check existing migrations directory for naming convention and numbering format:

```bash
ls packages/api/migrations/
```

### Anti-Patterns to Avoid

- **Storing empty string instead of null/undefined:** Always use `null` (not `''`) in the DB for absent address. Empty string would make "no address" checks ambiguous.
- **Always rendering an address row:** The email template must conditionally include the address row. If the row renders with an empty string, the email looks broken for manual-entry leads.
- **Sending address when map mode was abandoned mid-flow:** If a homeowner activates map mode, selects an address, then switches back to manual sqft entry, `selectedPlace` may still be set. The widget clears `selectedPlace` in App.tsx when toggling back — verify this is the case or clear it explicitly in the toggle handler.
- **Changing address field type to required:** The field must stay optional at every layer to preserve backward compatibility with the ContactInfo.tsx submit path for non-map submissions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML escaping for address string | Custom sanitizer | Existing `escapeHtml()` in lead-email-template.ts | Already handles `&`, `<`, `>`, `"` — addresses can contain `&` (e.g. "1st & Main") |
| Address parsing/normalization | Street/city/state extraction | Use `formattedAddress` as-is | `formattedAddress` from Google Places API is already human-readable and complete; parsing it adds complexity with no benefit |
| DB column add with downtime | Table recreation | `ALTER TABLE ... ADD COLUMN` | SQLite supports this as an online operation; no table lock needed |

## Common Pitfalls

### Pitfall 1: selectedPlace Not Cleared on Manual Mode Toggle

**What goes wrong:** Homeowner activates map mode, searches for address (selectedPlace is set), then clicks "Enter sqft manually" to go back. They manually enter sqft and submit. The address from the abandoned map session is included in the email even though they used manual entry.

**Why it happens:** `selectedPlace` persists in signal state after map mode is toggled off. The App.tsx toggle handler resets `isDrawingActive`, `hasFinishedPolygon`, `drawingSqft`, and calls `destroyDraw()` — but does it also reset `selectedPlace`?

Looking at App.tsx (the onClick for "Enter sqft manually"):
```typescript
onClick={() => {
  mapMode.value = false;
  selectedPlace.value = null;   // already sets this to null
  isDrawingActive.value = false;
  ...
}}
```

`selectedPlace.value = null` IS present in App.tsx. So the widget already clears the address on toggle. This pitfall is handled — confirm in testing.

**Warning signs:** Manual-entry test submissions containing a property address in the lead email.

### Pitfall 2: Drizzle Schema Type Mismatch After Column Add

**What goes wrong:** Adding `address: text('address')` to the Drizzle schema but forgetting that Drizzle infers this as `string | null`. Code that passes `address: undefined` to `db.insert(leads).values(...)` may need explicit `|| null` coercion.

**Why it happens:** Drizzle's insert type for a nullable column accepts `null` but TypeScript may warn on `undefined`. The validated schema returns `string | undefined` for optional fields.

**How to avoid:** Use `address: validated.address ?? null` in the DB insert to coerce `undefined` to `null`.

**Warning signs:** TypeScript compilation error in `estimates.ts` around the leads insert.

### Pitfall 3: Email Template Renders Extra Whitespace for Missing Address

**What goes wrong:** Conditional template literal leaves blank lines in the HTML when address is absent, which is harmless visually but messy.

**Why it happens:** Template literals with `${condition ? content : ''}` produce empty string when false, which is fine. This is not a real pitfall in this codebase — just confirm ternary returns `''` not a whitespace string.

**How to avoid:** Use `${data.address ? \`...\` : ''}` pattern exactly as shown in Pattern 1.

### Pitfall 4: Address Passed to Email When No Contact Fields Submitted

**What goes wrong:** The `estimates.ts` route only inserts a lead and sends email when contact fields are present (`if (validated.firstName && validated.lastName && ...)`). The address field is correctly scoped inside this conditional — it only matters for email-sending submissions.

**Why it happens:** This is not a pitfall — it is correct behavior by construction. However, it is worth noting for the planner: address storage and email inclusion only occur inside the existing `if (validated.firstName && ...)` block.

**Warning signs:** None — the conditional gate is already correct.

## Code Examples

### Address Row in Email HTML Table

```typescript
// Source: extension of existing lead-email-template.ts pattern
// Insert after the Phone row in the Contact Information table:
${data.address ? `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 120px;">Property Address</td>
        <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(data.address)}</td>
      </tr>` : ''}
```

### Test: Email Contains Address for Map Mode Submission

```typescript
// Extend packages/api/test/lead-notification.test.ts
it('includes property address in HTML when address is provided', () => {
  const leadWithAddress: LeadEmailData = {
    ...sampleLead,
    address: '123 Main St, Springfield, IL 62701',
  };
  const html = buildLeadEmailHtml(leadWithAddress);
  expect(html).toContain('Property Address');
  expect(html).toContain('123 Main St, Springfield, IL 62701');
});

it('omits property address row when address is absent', () => {
  const html = buildLeadEmailHtml(sampleLead); // sampleLead has no address field
  expect(html).not.toContain('Property Address');
});
```

### Test: API Accepts and Stores Address Field

```typescript
// Add to packages/api/test/estimates.test.ts (lead capture describe block)
it('stores address when provided with lead', async () => {
  const res = await app.request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      sqft: 2000, pitch: 'medium', material: 'architectural', companyId: 'test-company-1',
      firstName: 'John', lastName: 'Smith', email: 'jsmith@example.com', phone: '5551234567',
      consent: true,
      address: '456 Oak Ave, Chicago, IL 60601',
    }),
    headers: { 'Content-Type': 'application/json' },
  }, env);
  expect(res.status).toBe(200);

  const leads = await env.DB.prepare('SELECT address FROM leads WHERE email = ?')
    .bind('jsmith@example.com').all();
  expect(leads.results[0].address).toBe('456 Oak Ave, Chicago, IL 60601');
});

it('stores null address for manual-entry lead', async () => {
  const res = await app.request('/api/estimates', {
    method: 'POST',
    body: JSON.stringify({
      sqft: 2000, pitch: 'medium', material: 'architectural', companyId: 'test-company-1',
      firstName: 'Jane', lastName: 'Manual', email: 'jmanual@example.com', phone: '5559999999',
      consent: true,
      // no address field
    }),
    headers: { 'Content-Type': 'application/json' },
  }, env);
  expect(res.status).toBe(200);

  const leads = await env.DB.prepare('SELECT address FROM leads WHERE email = ?')
    .bind('jmanual@example.com').all();
  expect(leads.results[0].address).toBeNull();
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual sqft only — no address context | Address from Google Places `formattedAddress` (Phases 5-6) | v1.1 | `formattedAddress` is pre-formatted, human-readable, complete — just thread it through |
| Static email template with fixed fields | Conditional rendering for optional fields | This phase | Email stays backward-compatible with non-map submissions |

## Open Questions

1. **Migration file naming convention**
   - What we know: There is a `packages/api/migrations/` directory.
   - What's unclear: The existing numbering/naming format for migration files (e.g., `0001_...sql` or timestamp-based).
   - Recommendation: Check `ls packages/api/migrations/` before creating the migration file and follow the existing convention.

2. **Widget test coverage for address threading**
   - What we know: Widget tests are in `packages/widget/src/` using vitest (`packages/widget/vitest.config.ts` or similar). The test for `app.test.ts` covers UX-01 and UX-02 from Phase 6.
   - What's unclear: Whether a widget-level test for "address included in API call when map mode active" should be added, or whether the API-level test is sufficient coverage for LEAD-01.
   - Recommendation: API-level tests (estimates.test.ts) cover the storage + email behavior. A widget unit test on `ContactInfo.tsx` submit path that verifies `selectedPlace.formattedAddress` is included would provide defense-in-depth but is not required for the requirement to be satisfied.

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
| LEAD-01a | API stores address when provided | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "stores address"` | No — Wave 0 |
| LEAD-01b | API stores null address for manual-entry submission | unit | `cd packages/api && npx vitest run test/estimates.test.ts -t "stores null address"` | No — Wave 0 |
| LEAD-01c | Email HTML includes Property Address row when address present | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "includes property address"` | No — Wave 0 |
| LEAD-01d | Email HTML omits Property Address row when address absent | unit | `cd packages/api && npx vitest run test/lead-notification.test.ts -t "omits property address"` | No — Wave 0 |
| LEAD-01e | API accepts address field in Zod schema without error | unit | `cd packages/api && npx vitest run test/estimates.test.ts` (existing 200 path) | Partial — existing test validates schema; new address field needs to not break it |

### Sampling Rate
- **Per task commit:** `cd packages/api && npx vitest run`
- **Per wave merge:** `cd packages/api && npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] Add `stores address` and `stores null address` tests to `packages/api/test/estimates.test.ts` (new describe block or extend existing lead capture block) — covers LEAD-01a, LEAD-01b
- [ ] Add `includes property address` and `omits property address` tests to `packages/api/test/lead-notification.test.ts` — covers LEAD-01c, LEAD-01d
- [ ] DB migration must be applied before estimates tests run — the test setup seeds the `leads` table via `CREATE TABLE IF NOT EXISTS`; the test setup SQL in `beforeAll` must include `address text` column in the CREATE TABLE statement

## Sources

### Primary (HIGH confidence)

- Existing codebase: `packages/widget/src/state/map.ts` — `selectedPlace` signal with `formattedAddress` field confirmed
- Existing codebase: `packages/widget/src/App.tsx` — `selectedPlace.value = null` confirmed in manual mode toggle handler
- Existing codebase: `packages/widget/src/components/ContactInfo.tsx` — `submitEstimate()` call site confirmed; address field absent
- Existing codebase: `packages/api/src/validation/schemas.ts` — `estimateRequestSchema` confirmed; no address field
- Existing codebase: `packages/api/src/db/schema.ts` — `leads` table confirmed; no address column
- Existing codebase: `packages/api/src/routes/estimates.ts` — DB insert and `sendLeadNotification` call site confirmed
- Existing codebase: `packages/api/src/email/lead-email-template.ts` — `LeadEmailData` interface and HTML template confirmed
- SQLite docs: `ALTER TABLE ... ADD COLUMN` supports nullable columns without table recreation

### Secondary (MEDIUM confidence)

- Drizzle ORM convention: nullable `text()` column maps to `string | null` in insert types — standard behavior confirmed from Drizzle usage in existing schema

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; pure data-threading in existing well-understood stack
- Architecture: HIGH — all change sites identified by reading actual source; no guesswork
- Pitfalls: HIGH — `selectedPlace` clearing confirmed from actual App.tsx code; Drizzle nullable coercion is standard TypeScript pattern

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (stable codebase, no moving dependencies)
