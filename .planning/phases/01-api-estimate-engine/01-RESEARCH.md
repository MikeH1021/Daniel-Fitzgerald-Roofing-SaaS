# Phase 1: API + Estimate Engine - Research

**Researched:** 2026-03-09
**Domain:** Hono API on Cloudflare Workers with D1/Drizzle, roofing estimate calculation
**Confidence:** HIGH

## Summary

Phase 1 builds the foundational API that accepts roof parameters (square footage, pitch, material type) and returns a price range estimate. The stack is Hono (API framework) on Cloudflare Workers, with Cloudflare D1 (SQLite) via Drizzle ORM for persistence, and Zod for request validation. This phase has no frontend -- it is a pure API with JSON endpoints.

The estimate engine implements a straightforward formula: `sqft x pitch_multiplier x complexity_multiplier x material_cost_per_sqft`, producing a low-high range rounded to the nearest $100. The API must support company-specific pricing overrides (stored in D1) and fall back to sensible defaults when no overrides exist.

The entire phase is well-scoped with mature, well-documented libraries. The Hono + D1 + Drizzle combination is a well-trodden path with official documentation, starter templates, and community guides.

**Primary recommendation:** Build a Hono API with three concerns cleanly separated: (1) request validation via Zod schemas, (2) estimate calculation as a pure function, (3) company config lookup via Drizzle/D1. Test the estimate calculation logic as pure functions independent of the HTTP layer.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EST-01 | Homeowner can enter roof square footage (validated, 100-10,000 sqft range) | Zod schema validates sqft as number with `.min(100).max(10000)`; Hono zValidator middleware rejects invalid input with clear error |
| EST-02 | Homeowner can select roof pitch (Flat, Low, Medium, Steep) | Zod enum validation `z.enum(['flat', 'low', 'medium', 'steep'])`; pitch multiplier lookup table in estimate engine |
| EST-03 | Homeowner can select material type (3-tab shingles, architectural shingles, standing seam metal) | Zod enum validation; material cost ranges stored as defaults and company overrides in D1 |
| EST-04 | Homeowner sees estimated price range (e.g., "$8,900 - $12,800") | Estimate engine returns `{ estimateLow, estimateHigh }` computed from formula; rounding handled in engine |
| EST-05 | Price calculated using formula: sqft x pitch_multiplier x complexity_multiplier x material_cost_per_sqft | Pure function implementing the formula with default multipliers; company overrides applied when present |
| EST-06 | Estimates rounded to nearest $100 with "estimate only" disclaimer | `Math.round(value / 100) * 100` rounding; API response includes `disclaimer` field |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Hono | 4.x | API framework for Cloudflare Workers | Ultrafast (14KB), native Workers support, TypeScript-first, built-in CORS middleware. Official Cloudflare D1+Hono example in CF docs. |
| Zod | 3.x | Request/response validation | Pairs with `@hono/zod-validator` middleware for declarative validation. Schema-first approach gives type inference for free. |
| @hono/zod-validator | latest | Hono middleware for Zod validation | Official Hono middleware. Validates json, query, param targets. Returns typed data via `c.req.valid()`. |
| Drizzle ORM | 0.45.x | Type-safe database queries | Lightweight, first-class D1 support, schema-as-code with migrations. Much lighter than Prisma for edge. |
| Cloudflare D1 | GA | SQLite database at the edge | Co-located with Workers (zero network hop). Free tier: 5M reads/day, 100K writes/day, 5GB storage. |
| nanoid | 5.x | ID generation | Short, URL-safe, collision-resistant IDs for companies and estimates. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| drizzle-kit | latest | Database migration CLI | Schema changes -- generates SQL migration files |
| wrangler | latest | Cloudflare Workers CLI | Local dev server, D1 management, deployment |
| TypeScript | 5.x | Type safety | All source code |

### Dev/Test
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | ~3.x | Test runner | Unit and integration tests |
| @cloudflare/vitest-pool-workers | latest | Workers runtime test pool | Integration tests needing D1 bindings |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hono | Express/Fastify | Node.js-specific, no native Workers support, larger bundle |
| Drizzle | Prisma | Edge compatibility issues, larger bundle, slower cold starts |
| D1 | Neon/Supabase | Extra vendor, network hop to Postgres, overkill for this schema |
| Zod | Valibot | Slightly smaller but less ecosystem support with Hono |

**Installation:**
```bash
# Create project
npm create hono@latest roofing-api -- --template cloudflare-workers

# Core dependencies
npm install hono drizzle-orm @hono/zod-validator zod nanoid

# Dev dependencies
npm install -D drizzle-kit wrangler typescript @cloudflare/workers-types vitest @cloudflare/vitest-pool-workers
```

## Architecture Patterns

### Recommended Project Structure
```
packages/api/
  src/
    index.ts              # Hono app entry point, route mounting
    routes/
      estimates.ts        # POST /api/estimates endpoint
      config.ts           # GET /api/config/:companyId endpoint
    engine/
      calculate.ts        # Pure estimate calculation function
      defaults.ts         # Default pricing constants (materials, multipliers)
    db/
      schema.ts           # Drizzle schema definitions
      index.ts            # Drizzle client factory
    types.ts              # Shared TypeScript types
    validation/
      schemas.ts          # Zod schemas for request validation
  drizzle/
    migrations/           # Generated SQL migration files
  test/
    engine.test.ts        # Pure function tests for calculation
    estimates.test.ts     # API integration tests
    tsconfig.json         # Test-specific TypeScript config
    env.d.ts              # Binding type declarations for tests
  wrangler.toml           # Cloudflare Workers config
  drizzle.config.ts       # Drizzle Kit config
  vitest.config.ts        # Vitest config with Workers pool
  package.json
  tsconfig.json
```

### Pattern 1: Hono App with Typed D1 Bindings
**What:** Define environment bindings as a TypeScript type and pass to Hono as a generic. Access D1 via `c.env.DB`.
**When to use:** Every route handler that touches the database.
**Example:**
```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS: allow all origins for public widget endpoints
app.use('/api/config/*', cors({ origin: '*' }));
app.use('/api/estimates', cors({ origin: '*' }));

export default app;
```
Source: [Hono CF Workers docs](https://hono.dev/docs/getting-started/cloudflare-workers), [CF D1+Hono example](https://developers.cloudflare.com/d1/examples/d1-and-hono/)

### Pattern 2: Zod Validation Middleware
**What:** Use `zValidator` to validate request body before handler runs. Invalid requests get rejected with 400 automatically.
**When to use:** Every endpoint that accepts user input.
**Example:**
```typescript
// src/validation/schemas.ts
import { z } from 'zod';

export const estimateRequestSchema = z.object({
  sqft: z.number().min(100).max(10000),
  pitch: z.enum(['flat', 'low', 'medium', 'steep']),
  material: z.enum(['3-tab', 'architectural', 'standing-seam-metal']),
  companyId: z.string().min(1),
});

export type EstimateRequest = z.infer<typeof estimateRequestSchema>;

// src/routes/estimates.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { estimateRequestSchema } from '../validation/schemas';

const estimates = new Hono<{ Bindings: Bindings }>();

estimates.post(
  '/',
  zValidator('json', estimateRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: 'Invalid input',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      }, 400);
    }
  }),
  async (c) => {
    const data = c.req.valid('json');
    // data is fully typed: { sqft: number, pitch: ..., material: ..., companyId: string }
  }
);
```
Source: [Hono validation guide](https://hono.dev/docs/guides/validation), [@hono/zod-validator](https://www.npmjs.com/package/@hono/zod-validator)

### Pattern 3: Estimate Calculation as Pure Function
**What:** The pricing formula is a pure function with no side effects. Takes inputs + config, returns numbers. Easily testable.
**When to use:** Always separate calculation from HTTP/DB concerns.
**Example:**
```typescript
// src/engine/calculate.ts
import { DEFAULT_MATERIALS, DEFAULT_PITCH_MULTIPLIERS } from './defaults';

export interface PricingConfig {
  materials: Record<string, { costLow: number; costHigh: number }>;
  pitchMultipliers: Record<string, number>;
  complexityMultiplier: number;
}

export interface EstimateResult {
  estimateLow: number;
  estimateHigh: number;
  disclaimer: string;
}

export function calculateEstimate(
  sqft: number,
  pitch: string,
  material: string,
  config: PricingConfig
): EstimateResult {
  const materialCost = config.materials[material];
  const pitchMult = config.pitchMultipliers[pitch];
  const complexityMult = config.complexityMultiplier;

  const rawLow = sqft * pitchMult * complexityMult * materialCost.costLow;
  const rawHigh = sqft * pitchMult * complexityMult * materialCost.costHigh;

  return {
    estimateLow: Math.round(rawLow / 100) * 100,
    estimateHigh: Math.round(rawHigh / 100) * 100,
    disclaimer: 'This is an estimate only. Final pricing requires an on-site inspection.',
  };
}
```

### Pattern 4: Company Config with Default Fallback
**What:** Query D1 for company-specific pricing overrides. If none exist, use built-in defaults. Merge strategy: override fields replace defaults, missing fields keep defaults.
**When to use:** Every estimate request.
**Example:**
```typescript
// src/engine/defaults.ts
export const DEFAULT_MATERIALS = {
  '3-tab': { costLow: 3.50, costHigh: 4.75 },
  'architectural': { costLow: 4.00, costHigh: 5.75 },
  'standing-seam-metal': { costLow: 12.00, costHigh: 18.00 },
};

export const DEFAULT_PITCH_MULTIPLIERS = {
  flat: 1.00,
  low: 1.05,
  medium: 1.12,
  steep: 1.25,
};

// v1: complexity is baked into defaults (no user selection in Phase 1)
// Use "average" complexity multiplier (1.15 x 1.15 waste = 1.32)
export const DEFAULT_COMPLEXITY_MULTIPLIER = 1.0;
// Note: complexity_multiplier is 1.0 for v1 since EST-05 formula includes it
// but Phase 1 requirements don't include complexity selection (that's v2 EST-07)
```

### Pattern 5: Drizzle Schema with D1
**What:** Define tables using Drizzle's `sqliteTable`, generate migrations with `drizzle-kit generate`.
**Example:**
```typescript
// src/db/schema.ts
import { sqliteTable, text, real, integer } from 'drizzle-orm/sqlite-core';

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#2563eb'),
  createdAt: text('created_at').default("(datetime('now'))"),
  updatedAt: text('updated_at').default("(datetime('now'))"),
});

export const pricingOverrides = sqliteTable('pricing_overrides', {
  id: text('id').primaryKey(),
  companyId: text('company_id').notNull().references(() => companies.id),
  materialKey: text('material_key').notNull(), // '3-tab', 'architectural', 'standing-seam-metal'
  costLow: real('cost_low'),
  costHigh: real('cost_high'),
  pitchFlat: real('pitch_flat'),
  pitchLow: real('pitch_low'),
  pitchMedium: real('pitch_medium'),
  pitchSteep: real('pitch_steep'),
});

// src/db/index.ts
import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}
```
Source: [Drizzle D1 docs](https://orm.drizzle.team/docs/connect-cloudflare-d1)

### Anti-Patterns to Avoid
- **Baking pricing constants into the API response format:** Keep the engine generic. Return numbers; let the frontend format them as currency.
- **Coupling validation to route handlers:** Define Zod schemas separately so they can be shared with the widget package later.
- **Using D1's raw SQL API directly:** Always go through Drizzle for type safety and migration management.
- **Storing calculated estimates in the database for Phase 1:** Phase 1 has no lead capture. The estimate is computed and returned, not persisted. Lead storage comes in Phase 2.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request validation | Manual if/else checking | Zod + @hono/zod-validator | Handles type coercion, nested objects, error formatting, TypeScript inference |
| Database migrations | Raw SQL files | drizzle-kit generate + wrangler d1 migrations apply | Tracks schema changes, generates correct SQL, handles local vs remote |
| CORS handling | Manual headers | `hono/cors` middleware | Handles preflight, allowed methods, credentials correctly |
| ID generation | UUID or Math.random | nanoid | URL-safe, shorter, configurable alphabet, no collisions at this scale |
| Local dev server | Custom scripts | `wrangler dev` | Simulates D1 locally, handles bindings, hot reload |

**Key insight:** This phase is essentially a validated JSON API with a math function behind it. Every piece of infrastructure (validation, CORS, database, testing) has a standard solution. The only custom code should be the pricing formula itself and the route handlers that wire everything together.

## Common Pitfalls

### Pitfall 1: Forgetting Content-Type Header in Tests
**What goes wrong:** `zValidator('json', schema)` silently returns 400 when the request lacks `Content-Type: application/json`.
**Why it happens:** `app.request()` doesn't set Content-Type by default.
**How to avoid:** Always include `headers: { 'Content-Type': 'application/json' }` in test requests that send JSON bodies.
**Warning signs:** Tests returning 400 with no validation error details.

### Pitfall 2: D1 Integer vs Real Types
**What goes wrong:** SQLite has dynamic typing. Drizzle's `real()` column type maps to REAL but D1 may return integers for whole numbers.
**Why it happens:** SQLite stores 5.00 as integer 5 internally.
**How to avoid:** Always use `real()` for pricing columns. In TypeScript, treat returned values as `number` (which handles both).
**Warning signs:** Type mismatches when comparing database values to expected floats.

### Pitfall 3: Complexity Multiplier Scope in v1
**What goes wrong:** The EST-05 formula includes `complexity_multiplier` but Phase 1 requirements do NOT include complexity selection (that is v2 EST-07). Building complexity selection now is scope creep.
**Why it happens:** The formula mentions it, so developers assume it needs UI.
**How to avoid:** Set `complexity_multiplier = 1.0` as the default in v1. The formula still multiplies by it (future-proof), but the API does not accept it as input yet. Document this decision.
**Warning signs:** Adding a complexity field to the request schema in Phase 1.

### Pitfall 4: Wrangler D1 Local vs Remote
**What goes wrong:** `wrangler d1 execute` defaults to local. Migrations applied locally don't apply to remote D1.
**Why it happens:** D1 has separate local (`.wrangler/state/`) and remote databases.
**How to avoid:** Use `--local` explicitly during development and `--remote` for production. Migration commands: `wrangler d1 migrations apply DB --local` vs `--remote`.
**Warning signs:** Schema exists locally but queries fail on deployed Worker.

### Pitfall 5: Floating Point Rounding Display
**What goes wrong:** `Math.round(8873.42 / 100) * 100` works correctly, but edge cases like `Math.round(8850 / 100) * 100 = 8800` (banker's rounding in some engines).
**Why it happens:** JavaScript's `Math.round` rounds 0.5 up (not banker's rounding), so this is actually safe. But the concern is valid for other languages.
**How to avoid:** Use `Math.round()` in JavaScript -- it always rounds 0.5 up. Write explicit test cases for boundary values (e.g., sqft that produces estimates ending in exactly X50).
**Warning signs:** Estimates that look "off by $100" to users.

## Code Examples

### Complete Estimate Endpoint (Wired Together)
```typescript
// src/routes/estimates.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { estimateRequestSchema } from '../validation/schemas';
import { calculateEstimate, PricingConfig } from '../engine/calculate';
import { DEFAULT_MATERIALS, DEFAULT_PITCH_MULTIPLIERS, DEFAULT_COMPLEXITY_MULTIPLIER } from '../engine/defaults';
import { createDb } from '../db';
import { pricingOverrides } from '../db/schema';

type Bindings = { DB: D1Database };

const estimates = new Hono<{ Bindings: Bindings }>();

estimates.post(
  '/',
  zValidator('json', estimateRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json({
        error: 'Invalid input',
        details: result.error.issues.map(i => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      }, 400);
    }
  }),
  async (c) => {
    const { sqft, pitch, material, companyId } = c.req.valid('json');

    // Build pricing config: start with defaults, apply company overrides
    const config: PricingConfig = {
      materials: { ...DEFAULT_MATERIALS },
      pitchMultipliers: { ...DEFAULT_PITCH_MULTIPLIERS },
      complexityMultiplier: DEFAULT_COMPLEXITY_MULTIPLIER,
    };

    // Look up company overrides
    const db = createDb(c.env.DB);
    const overrides = await db
      .select()
      .from(pricingOverrides)
      .where(eq(pricingOverrides.companyId, companyId));

    // Apply overrides
    for (const override of overrides) {
      if (override.materialKey && config.materials[override.materialKey]) {
        if (override.costLow != null) config.materials[override.materialKey].costLow = override.costLow;
        if (override.costHigh != null) config.materials[override.materialKey].costHigh = override.costHigh;
      }
      if (override.pitchFlat != null) config.pitchMultipliers.flat = override.pitchFlat;
      if (override.pitchLow != null) config.pitchMultipliers.low = override.pitchLow;
      if (override.pitchMedium != null) config.pitchMultipliers.medium = override.pitchMedium;
      if (override.pitchSteep != null) config.pitchMultipliers.steep = override.pitchSteep;
    }

    const result = calculateEstimate(sqft, pitch, material, config);

    return c.json(result);
  }
);

export { estimates };
```

### Wrangler Configuration
```toml
# wrangler.toml
name = "roofing-api"
main = "src/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "roofing_calculator"
database_id = "YOUR_DB_ID_HERE"
migrations_dir = "drizzle/migrations"
```

### Drizzle Kit Configuration
```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
});
```

### Test Example: Pure Calculation Function
```typescript
// test/engine.test.ts
import { describe, it, expect } from 'vitest';
import { calculateEstimate } from '../src/engine/calculate';

const defaultConfig = {
  materials: {
    'architectural': { costLow: 4.00, costHigh: 5.75 },
  },
  pitchMultipliers: { flat: 1.00, low: 1.05, medium: 1.12, steep: 1.25 },
  complexityMultiplier: 1.0,
};

describe('calculateEstimate', () => {
  it('calculates correct range for architectural shingles, medium pitch', () => {
    const result = calculateEstimate(1800, 'medium', 'architectural', defaultConfig);
    // 1800 * 1.12 * 1.0 * 4.00 = 8064 -> rounded to 8100
    // 1800 * 1.12 * 1.0 * 5.75 = 11592 -> rounded to 11600
    expect(result.estimateLow).toBe(8100);
    expect(result.estimateHigh).toBe(11600);
  });

  it('rounds to nearest $100', () => {
    const result = calculateEstimate(1000, 'flat', 'architectural', defaultConfig);
    // 1000 * 1.00 * 1.0 * 4.00 = 4000 -> 4000
    // 1000 * 1.00 * 1.0 * 5.75 = 5750 -> 5800
    expect(result.estimateLow).toBe(4000);
    expect(result.estimateHigh).toBe(5800);
  });

  it('includes disclaimer', () => {
    const result = calculateEstimate(1000, 'flat', 'architectural', defaultConfig);
    expect(result.disclaimer).toContain('estimate only');
  });
});
```

### Test Example: API Integration
```typescript
// test/estimates.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('POST /api/estimates', () => {
  it('rejects missing sqft', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ pitch: 'medium', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects sqft below 100', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 50, pitch: 'medium', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects sqft above 10000', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 15000, pitch: 'medium', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid pitch', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 2000, pitch: 'extreme', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(400);
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Express on Node.js | Hono on Workers | 2023-2024 | Edge deployment, no server management, global low latency |
| Prisma for edge DB | Drizzle ORM | 2024 | Smaller bundle, native D1 support, no edge compatibility issues |
| Raw SQL migrations | drizzle-kit generate | 2024 | Type-safe schema, auto-generated migrations |
| wrangler.toml | wrangler.json (also supported) | 2024 | JSON format available but TOML still standard |

**Deprecated/outdated:**
- Drizzle config `driver: 'd1'` has been replaced by `dialect: 'sqlite'` in recent drizzle-kit versions. Use `dialect: 'sqlite'` for D1.
- `drizzle-kit push` works for development but `drizzle-kit generate` + `wrangler d1 migrations apply` is recommended for production D1.

## Open Questions

1. **Complexity multiplier in v1 formula**
   - What we know: EST-05 formula includes `complexity_multiplier`. EST-07 (complexity selection) is v2.
   - What's unclear: Should the API accept an optional complexity field now for future-proofing, or strictly omit it?
   - Recommendation: Omit from v1 request schema. Set `complexity_multiplier = 1.0` internally. The formula still works with it, making v2 addition trivial.

2. **Company validation on estimate requests**
   - What we know: The API needs a `companyId` to look up overrides.
   - What's unclear: Should the API return an error for unknown company IDs, or silently use defaults?
   - Recommendation: Use defaults for unknown company IDs. This is more resilient -- if a company hasn't configured overrides yet, the widget still works. Add a `configSource: 'default' | 'company'` field to the response so callers know which config was used.

3. **Seed data for development/testing**
   - What we know: We need at least one test company to develop against.
   - Recommendation: Create a seed script that inserts a test company with known overrides. Use this in local dev and tests.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest ~3.x with @cloudflare/vitest-pool-workers |
| Config file | `packages/api/vitest.config.ts` (Wave 0 creation) |
| Quick run command | `npx vitest run --reporter=verbose` |
| Full suite command | `npx vitest run` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EST-01 | Validates sqft 100-10,000, rejects outside range | unit | `npx vitest run test/estimates.test.ts -t "sqft"` | No -- Wave 0 |
| EST-02 | Validates pitch enum (flat/low/medium/steep) | unit | `npx vitest run test/estimates.test.ts -t "pitch"` | No -- Wave 0 |
| EST-03 | Validates material enum, looks up correct costs | unit | `npx vitest run test/estimates.test.ts -t "material"` | No -- Wave 0 |
| EST-04 | Returns estimateLow and estimateHigh as numbers | unit | `npx vitest run test/engine.test.ts -t "range"` | No -- Wave 0 |
| EST-05 | Formula: sqft x pitch x complexity x material cost | unit | `npx vitest run test/engine.test.ts -t "calculate"` | No -- Wave 0 |
| EST-06 | Rounds to nearest $100, includes disclaimer string | unit | `npx vitest run test/engine.test.ts -t "round"` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --reporter=verbose`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `packages/api/vitest.config.ts` -- Vitest config with Workers pool
- [ ] `packages/api/test/tsconfig.json` -- Test TypeScript config
- [ ] `packages/api/test/env.d.ts` -- Binding type declarations
- [ ] `packages/api/test/engine.test.ts` -- Pure calculation function tests (EST-04, EST-05, EST-06)
- [ ] `packages/api/test/estimates.test.ts` -- API endpoint validation tests (EST-01, EST-02, EST-03)
- [ ] Framework install: `npm install -D vitest @cloudflare/vitest-pool-workers`

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM + Cloudflare D1](https://orm.drizzle.team/docs/connect-cloudflare-d1) -- schema definition, migration workflow, D1 client setup
- [Hono Cloudflare Workers guide](https://hono.dev/docs/getting-started/cloudflare-workers) -- bindings types, app creation, deployment
- [Hono validation guide](https://hono.dev/docs/guides/validation) -- zValidator usage, validation targets, error handling
- [CF D1+Hono example](https://developers.cloudflare.com/d1/examples/d1-and-hono/) -- official Cloudflare example of D1 with Hono
- [CF Workers Vitest integration](https://developers.cloudflare.com/workers/testing/vitest-integration/) -- test setup, pool configuration, binding access
- [Hono testing guide](https://hono.dev/docs/guides/testing) -- app.request() method, env mocking

### Secondary (MEDIUM confidence)
- [Hono+Drizzle+D1 setup guide](https://www.firdausng.com/posts/setup-d1-cloudflare-worker-with-drizzle) -- practical integration tutorial
- [@hono/zod-validator npm](https://www.npmjs.com/package/@hono/zod-validator) -- middleware API reference
- [Hono+Drizzle+D1+R2 template](https://medium.com/@kupriyanov.vo/setup-hono-drizzle-orm-template-project-for-cloudflare-d1-and-r2-bucket-9e13cdd37156) -- project structure patterns

### Tertiary (LOW confidence)
- None -- all findings verified against official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries have official documentation and are well-established for this exact use case (Hono+D1+Drizzle)
- Architecture: HIGH -- patterns verified against official Cloudflare and Hono docs, multiple community guides confirm approach
- Pitfalls: HIGH -- derived from official docs (Content-Type requirement, local vs remote D1) and practical testing guides
- Pricing formula: HIGH -- multipliers and material costs sourced from multiple industry references in FEATURES.md

**Research date:** 2026-03-09
**Valid until:** 2026-04-09 (stable stack, 30-day validity)
