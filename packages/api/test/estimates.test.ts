import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

// Seed test data into D1 before tests
async function seedTestData(db: D1Database) {
  // Apply migration schema -- D1 exec requires single statements
  await db.exec("CREATE TABLE IF NOT EXISTS companies (id text PRIMARY KEY NOT NULL, name text NOT NULL, email text NOT NULL, logo_url text, primary_color text DEFAULT '#2563eb', created_at text DEFAULT (datetime('now')), updated_at text DEFAULT (datetime('now')));");
  await db.exec("CREATE TABLE IF NOT EXISTS pricing_overrides (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, material_key text NOT NULL, cost_low real, cost_high real, pitch_flat real, pitch_low real, pitch_medium real, pitch_steep real, FOREIGN KEY (company_id) REFERENCES companies(id));");

  // Insert test company
  await db.exec("INSERT OR REPLACE INTO companies (id, name, email, logo_url, primary_color) VALUES ('test-company-1', 'Acme Roofing', 'test@acme.com', 'https://acme.com/logo.png', '#ff0000');");

  // Insert pricing override for architectural material
  await db.exec("INSERT OR REPLACE INTO pricing_overrides (id, company_id, material_key, cost_low, cost_high) VALUES ('override-1', 'test-company-1', 'architectural', 4.50, 6.25);");
}

describe('POST /api/estimates', () => {
  beforeAll(async () => {
    await seedTestData(env.DB);
  });

  it('rejects missing sqft with 400 and error details', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ pitch: 'medium', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string; details: Array<{ field: string; message: string }> };
    expect(body.error).toBe('Invalid input');
    expect(body.details).toBeDefined();
    expect(body.details.length).toBeGreaterThan(0);
  });

  it('rejects sqft below 100 with 400', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 50, pitch: 'medium', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(400);
  });

  it('rejects sqft above 10000 with 400', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 15000, pitch: 'medium', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(400);
  });

  it('rejects invalid pitch ("extreme") with 400', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 2000, pitch: 'extreme', material: 'architectural', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(400);
  });

  it('rejects invalid material ("copper") with 400', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 2000, pitch: 'medium', material: 'copper', companyId: 'test' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(400);
  });

  it('returns 200 with estimateLow, estimateHigh, disclaimer, and configSource for valid input', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 1800, pitch: 'medium', material: 'architectural', companyId: 'unknown-company' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { estimateLow: number; estimateHigh: number; disclaimer: string; configSource: string };
    expect(body.estimateLow).toBeTypeOf('number');
    expect(body.estimateHigh).toBeTypeOf('number');
    expect(body.estimateLow).toBeGreaterThan(0);
    expect(body.estimateHigh).toBeGreaterThan(body.estimateLow);
    expect(body.disclaimer).toBeDefined();
    expect(body.configSource).toBeDefined();
  });

  it('uses default pricing for unknown companyId (configSource: "default")', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 1800, pitch: 'medium', material: 'architectural', companyId: 'unknown-company' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { configSource: string; estimateLow: number; estimateHigh: number };
    expect(body.configSource).toBe('default');
    // Default architectural: costLow=4.00, costHigh=5.75, medium pitch=1.12
    // 1800 * 1.12 * 1.0 * 4.00 = 8064 -> 8100
    // 1800 * 1.12 * 1.0 * 5.75 = 11592 -> 11600
    expect(body.estimateLow).toBe(8100);
    expect(body.estimateHigh).toBe(11600);
  });

  it('uses override pricing for company with overrides (configSource: "company")', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 1800, pitch: 'medium', material: 'architectural', companyId: 'test-company-1' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { configSource: string; estimateLow: number; estimateHigh: number };
    expect(body.configSource).toBe('company');
    // Override architectural: costLow=4.50, costHigh=6.25, medium pitch=1.12
    // 1800 * 1.12 * 1.0 * 4.50 = 9072 -> 9100
    // 1800 * 1.12 * 1.0 * 6.25 = 12600 -> 12600
    expect(body.estimateLow).toBe(9100);
    expect(body.estimateHigh).toBe(12600);
  });
});

describe('POST /api/estimates - lead capture', () => {
  beforeAll(async () => {
    await seedTestData(env.DB);
    // Create leads table for lead capture tests
    await env.DB.exec("CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL, phone text NOT NULL, consent_given integer NOT NULL, consent_text text NOT NULL, sqft real NOT NULL, pitch text NOT NULL, material text NOT NULL, estimate_low real NOT NULL, estimate_high real NOT NULL, created_at text DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id));");
  });

  it('stores lead when contact fields and consent=true provided', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({
        sqft: 2000, pitch: 'medium', material: 'architectural', companyId: 'test-company-1',
        firstName: 'John', lastName: 'Doe', email: 'john@example.com', phone: '5551234567', consent: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { estimateLow: number; estimateHigh: number; disclaimer: string; configSource: string };
    expect(body.estimateLow).toBeTypeOf('number');
    expect(body.estimateHigh).toBeTypeOf('number');
    expect(body.configSource).toBe('company');

    // Verify lead was stored in the database
    const leads = await env.DB.prepare('SELECT * FROM leads WHERE email = ?').bind('john@example.com').all();
    expect(leads.results.length).toBe(1);
    const lead = leads.results[0] as any;
    expect(lead.first_name).toBe('John');
    expect(lead.last_name).toBe('Doe');
    expect(lead.phone).toBe('5551234567');
    expect(lead.consent_given).toBe(1);
    expect(lead.consent_text).toContain('Acme Roofing');
  });

  it('returns 400 when contact fields present but consent=false', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({
        sqft: 2000, pitch: 'medium', material: 'architectural', companyId: 'test-company-1',
        firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com', phone: '5559876543', consent: false,
      }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(400);
  });

  it('returns 400 when some contact fields missing', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({
        sqft: 2000, pitch: 'medium', material: 'architectural', companyId: 'test-company-1',
        firstName: 'Jane', consent: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(400);
  });

  it('still works without contact fields (backward compatible)', async () => {
    const res = await app.request('/api/estimates', {
      method: 'POST',
      body: JSON.stringify({ sqft: 2000, pitch: 'medium', material: 'architectural', companyId: 'test-company-1' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { estimateLow: number; estimateHigh: number };
    expect(body.estimateLow).toBeTypeOf('number');
    expect(body.estimateHigh).toBeTypeOf('number');
  });
});

describe('GET /api/config/:companyId', () => {
  beforeAll(async () => {
    await seedTestData(env.DB);
  });

  it('returns company info for known company', async () => {
    const res = await app.request('/api/config/test-company-1', {
      method: 'GET',
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string; name: string; logoUrl: string; primaryColor: string };
    expect(body.id).toBe('test-company-1');
    expect(body.name).toBe('Acme Roofing');
    expect(body.logoUrl).toBe('https://acme.com/logo.png');
    expect(body.primaryColor).toBe('#ff0000');
  });

  it('returns 404 for unknown company', async () => {
    const res = await app.request('/api/config/nonexistent', {
      method: 'GET',
    }, env);
    expect(res.status).toBe(404);
    const body = await res.json() as { error: string };
    expect(body.error).toBe('Company not found');
  });
});
