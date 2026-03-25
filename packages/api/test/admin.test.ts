import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

async function seedAdminData(db: D1Database) {
  // D1 exec requires single-line statements
  await db.exec("CREATE TABLE IF NOT EXISTS companies (id text PRIMARY KEY NOT NULL, name text NOT NULL, email text NOT NULL, slug text, password_hash text, logo_url text, primary_color text DEFAULT '#2563eb', role text NOT NULL DEFAULT 'company-admin', created_at text DEFAULT (datetime('now')), updated_at text DEFAULT (datetime('now')));");
  await db.exec("CREATE TABLE IF NOT EXISTS admin_sessions (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, expires_at text NOT NULL, created_at text DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id));");
  await db.exec("CREATE TABLE IF NOT EXISTS pricing_overrides (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, material_key text NOT NULL, cost_low real, cost_high real, pitch_flat real, pitch_low real, pitch_medium real, pitch_steep real, FOREIGN KEY (company_id) REFERENCES companies(id));");
}

let _setupLoginIpCounter = 100;

/** Helper to setup a password and login, returning the session cookie.
 * Uses a unique IP per call to avoid rate limiter interference across test suites.
 */
async function setupAndLogin(email: string, password: string): Promise<string> {
  const ip = `10.0.0.${_setupLoginIpCounter++}`;
  await app.request('/api/admin/setup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  }, env);

  const loginRes = await app.request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
  }, env);
  const setCookieHeader = loginRes.headers.get('set-cookie') || '';
  const match = setCookieHeader.match(/session=([^;]+)/);
  return match ? match[1] : '';
}

describe('POST /api/admin/setup', () => {
  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('setup-company', 'Setup Co', 'setup@test.com', '#2563eb');");
  });

  it('sets password for company without one', async () => {
    const res = await app.request('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'setup@test.com', password: 'MySecurePass123!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});

describe('POST /api/admin/setup - 409 when already set', () => {
  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('setup-company', 'Setup Co', 'setup@test.com', '#2563eb');");
    // Pre-set the password via the setup endpoint
    await app.request('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'setup@test.com', password: 'MySecurePass123!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
  });

  it('returns 409 if password already set', async () => {
    const res = await app.request('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'setup@test.com', password: 'AnotherPass123!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/admin/login', () => {
  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('login-company', 'Login Co', 'login@test.com', '#2563eb');");
    // Set password via setup endpoint
    await app.request('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'login@test.com', password: 'TestPassword1!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
  });

  it('returns 200 with Set-Cookie for valid credentials', async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'login@test.com', password: 'TestPassword1!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { companyId: string; name: string };
    expect(body.companyId).toBe('login-company');
    expect(body.name).toBe('Login Co');
    const setCookieHeader = res.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('session=');
    expect(setCookieHeader).toContain('HttpOnly');
  });

  it('returns 401 for wrong password', async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'login@test.com', password: 'WrongPass!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'nobody@test.com', password: 'TestPassword1!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(401);
  });
});

describe('Protected routes without auth', () => {
  beforeAll(async () => {
    await seedAdminData(env.DB);
  });

  it('GET /api/admin/companies returns 401', async () => {
    const res = await app.request('/api/admin/companies', { method: 'GET' }, env);
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/logout returns 401', async () => {
    const res = await app.request('/api/admin/logout', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/me returns 401', async () => {
    const res = await app.request('/api/admin/me', { method: 'GET' }, env);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/admin/companies/:companyId/settings', () => {
  let sessionCookie: string;
  const companyId = 'settings-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('${companyId}', 'Settings Co', 'settings@test.com', '#2563eb');`);
    sessionCookie = await setupAndLogin('settings@test.com', 'SettingsPass1!');
  });

  it('updates primary color with valid hex', async () => {
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff5500' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        Origin: 'http://localhost',
      },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('rejects invalid hex color', async () => {
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: 'notacolor' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        Origin: 'http://localhost',
      },
    }, env);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/companies/:companyId/settings - returns updated values', () => {
  let sessionCookie: string;
  const companyId = 'settings-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('${companyId}', 'Settings Co', 'settings@test.com', '#2563eb');`);
    sessionCookie = await setupAndLogin('settings@test.com', 'SettingsPass1!');
    // Apply the PATCH so GET can verify
    await app.request(`http://localhost/api/admin/companies/${companyId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff5500' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        Origin: 'http://localhost',
      },
    }, env);
  });

  it('returns the updated primary color', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/settings`, {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string; primaryColor: string };
    expect(body.name).toBe('Settings Co');
    expect(body.primaryColor).toBe('#ff5500');
  });
});

describe('PUT /api/admin/companies/:companyId/pricing', () => {
  let sessionCookie: string;
  const companyId = 'pricing-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('${companyId}', 'Pricing Co', 'pricing@test.com', '#2563eb');`);
    sessionCookie = await setupAndLogin('pricing@test.com', 'PricingPass1!');
  });

  it('replaces all pricing overrides for the company', async () => {
    const overrides = [
      { materialKey: 'architectural', costLow: 5.0, costHigh: 7.0 },
      { materialKey: '3-tab', costLow: 3.0, costHigh: 4.5, pitchSteep: 1.4 },
    ];
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        Origin: 'http://localhost',
      },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; count: number };
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
  });
});

describe('GET /api/admin/companies/:companyId/pricing - returns current overrides', () => {
  let sessionCookie: string;
  const companyId = 'pricing-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('${companyId}', 'Pricing Co', 'pricing@test.com', '#2563eb');`);
    sessionCookie = await setupAndLogin('pricing@test.com', 'PricingPass1!');
    // Apply PUT so GET can verify
    const overrides = [
      { materialKey: 'architectural', costLow: 5.0, costHigh: 7.0 },
      { materialKey: '3-tab', costLow: 3.0, costHigh: 4.5, pitchSteep: 1.4 },
    ];
    await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        Origin: 'http://localhost',
      },
    }, env);
  });

  it('returns the current overrides', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/pricing`, {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as Array<{ materialKey: string }>;
    expect(body.length).toBe(2);
    const keys = body.map((o) => o.materialKey);
    expect(keys).toContain('architectural');
    expect(keys).toContain('3-tab');
  });
});

describe('POST /api/admin/logout', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('logout-company', 'Logout Co', 'logout@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('logout@test.com', 'LogoutPass1!');
  });

  it('clears session and returns success', async () => {
    const res = await app.request('http://localhost/api/admin/logout', {
      method: 'POST',
      headers: { Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    const setCookieHeader = res.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('session=');
  });
});

describe('POST /api/admin/companies/:companyId/logo', () => {
  let sessionCookie: string;
  const companyId = 'logo-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('${companyId}', 'Logo Co', 'logo@test.com', '#2563eb');`);
    sessionCookie = await setupAndLogin('logo@test.com', 'LogoPass123!');
  });

  it('uploads a valid PNG and updates logoUrl', async () => {
    // Minimal 1x1 PNG
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const file = new File([pngBytes], 'logo.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('logo', file);

    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/logo`, {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { logoUrl: string };
    expect(body.logoUrl).toContain(companyId);
  });

  it('rejects files over 1MB', async () => {
    const bigData = new Uint8Array(1048577); // 1MB + 1 byte
    const file = new File([bigData], 'big.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('logo', file);

    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/logo`, {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/too large|1MB/i);
  });

  it('rejects non-image file types', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('logo', file);

    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/logo`, {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/invalid file type|image/i);
  });
});

describe('GET /api/logos/:companyId', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('logo-serve-company', 'Logo Serve Co', 'logoserve@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('logoserve@test.com', 'LogoServe1!');
    // Upload a logo first
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00,
      0x0c, 0x49, 0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
      0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, 0x00,
      0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    const file = new File([pngBytes], 'logo.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('logo', file);
    await app.request('http://localhost/api/admin/companies/logo-serve-company/logo', {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
  });

  it('serves uploaded logo with correct content-type', async () => {
    const res = await app.request('/api/logos/logo-serve-company', {
      method: 'GET',
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
    // Consume body to release R2 stream for test isolation
    await res.arrayBuffer();
  });

  it('returns 404 for unknown company logo', async () => {
    const res = await app.request('/api/logos/nonexistent-company', {
      method: 'GET',
    }, env);
    expect(res.status).toBe(404);
  });
});

describe('POST /api/admin/logout - session invalidated', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('logout-company', 'Logout Co', 'logout@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('logout@test.com', 'LogoutPass1!');
    // Perform logout in beforeAll so the session is gone
    await app.request('http://localhost/api/admin/logout', {
      method: 'POST',
      headers: { Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
  });

  it('returns 401 after logout', async () => {
    const res = await app.request('/api/admin/me', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(401);
  });
});

// ============================================================
// RBAC Tests
// ============================================================

describe('RBAC - super-admin vs company-admin access', () => {
  let superAdminCookie: string;
  let companyAdminCookie: string;
  const superAdminId = 'super-admin-company';
  const companyAdminId = 'company-admin-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    // Insert super-admin company
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${superAdminId}', 'Super Admin Co', 'superadmin@test.com', '#2563eb', 'super-admin');`);
    // Insert company-admin company
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${companyAdminId}', 'Company Admin Co', 'companyadmin@test.com', '#2563eb', 'company-admin');`);
    superAdminCookie = await setupAndLogin('superadmin@test.com', 'SuperAdmin1!');
    companyAdminCookie = await setupAndLogin('companyadmin@test.com', 'CompanyAdmin1!');
  });

  it('super-admin can GET /api/admin/companies (200)', async () => {
    const res = await app.request('/api/admin/companies', {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
  });

  it('company-admin GET /api/admin/companies returns 403', async () => {
    const res = await app.request('/api/admin/companies', {
      method: 'GET',
      headers: { Cookie: `session=${companyAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(403);
  });

  it('company-admin can access own company settings (200)', async () => {
    const res = await app.request(`/api/admin/companies/${companyAdminId}/settings`, {
      method: 'GET',
      headers: { Cookie: `session=${companyAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
  });

  it('company-admin cannot access another company settings (403)', async () => {
    const res = await app.request(`/api/admin/companies/${superAdminId}/settings`, {
      method: 'GET',
      headers: { Cookie: `session=${companyAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(403);
  });

  it('super-admin can access any company settings (200)', async () => {
    const res = await app.request(`/api/admin/companies/${companyAdminId}/settings`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
  });

  it('GET /api/admin/me returns companyId and role', async () => {
    const res = await app.request('/api/admin/me', {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { companyId: string; role: string };
    expect(body.companyId).toBe(superAdminId);
    expect(body.role).toBe('super-admin');
  });
});

// ============================================================
// Rate Limiting Tests
// ============================================================

describe('Login rate limiting', () => {
  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('ratelimit-company', 'Rate Limit Co', 'ratelimit@test.com', '#2563eb');");
    await app.request('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify({ email: 'ratelimit@test.com', password: 'RatePass1!' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
  });

  it('returns 429 after 5 failed login attempts within 60 seconds', async () => {
    // Make 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await app.request('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'ratelimit@test.com', password: 'WrongPass!' }),
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
      }, env);
    }
    // 6th attempt should be rate limited
    const res = await app.request('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'ratelimit@test.com', password: 'WrongPass!' }),
      headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': '1.2.3.4' },
    }, env);
    expect(res.status).toBe(429);
  });
});

// ============================================================
// CSRF Tests
// ============================================================

describe('CSRF protection', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('csrf-company', 'CSRF Co', 'csrf@test.com', '#2563eb', 'super-admin');");
    sessionCookie = await setupAndLogin('csrf@test.com', 'CsrfPass1!');
  });

  it('state-changing request (PATCH) without Origin header or CSRF token returns 403', async () => {
    const res = await app.request('/api/admin/companies/csrf-company/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff0000' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        // No Origin header, no X-CSRF-Token
      },
    }, env);
    expect(res.status).toBe(403);
  });

  it('state-changing request with matching Origin header succeeds', async () => {
    const res = await app.request('http://localhost/api/admin/companies/csrf-company/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff0000' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        Origin: 'http://localhost',
      },
    }, env);
    expect(res.status).toBe(200);
  });

  it('GET requests are exempt from CSRF check', async () => {
    const res = await app.request('/api/admin/companies/csrf-company/settings', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
  });

  it('state-changing request with valid X-CSRF-Token header succeeds', async () => {
    // First get the CSRF token
    const tokenRes = await app.request('/api/admin/csrf-token', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(tokenRes.status).toBe(200);
    const { token } = await tokenRes.json() as { token: string };

    const res = await app.request('/api/admin/companies/csrf-company/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#00ff00' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
        'X-CSRF-Token': token,
      },
    }, env);
    expect(res.status).toBe(200);
  });
});

// ============================================================
// Task 1 (08-02): Legacy route removal + company-scoped embed-code
// ============================================================

describe('Legacy session-scoped routes removed (404)', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('legacy-company', 'Legacy Co', 'legacy@test.com', '#2563eb', 'super-admin');");
    sessionCookie = await setupAndLogin('legacy@test.com', 'LegacyPass1!');
  });

  it('GET /api/admin/settings returns 404', async () => {
    const res = await app.request('/api/admin/settings', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(404);
  });

  it('PATCH /api/admin/settings returns 404', async () => {
    const res = await app.request('http://localhost/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff0000' }),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(404);
  });

  it('GET /api/admin/pricing returns 404', async () => {
    const res = await app.request('/api/admin/pricing', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/pricing returns 404', async () => {
    const res = await app.request('http://localhost/api/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify([]),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(404);
  });

  it('POST /api/admin/logo returns 404', async () => {
    const formData = new FormData();
    formData.append('logo', new File(['x'], 'x.png', { type: 'image/png' }));
    const res = await app.request('http://localhost/api/admin/logo', {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(404);
  });

  it('GET /api/admin/embed-code returns 404', async () => {
    const res = await app.request('/api/admin/embed-code', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(404);
  });

  it('POST /api/admin/logout still works (200)', async () => {
    const logoutCookie = await setupAndLogin('legacy@test.com', 'LegacyPass1!');
    const res = await app.request('http://localhost/api/admin/logout', {
      method: 'POST',
      headers: { Cookie: `session=${logoutCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});

describe('GET /api/admin/companies/:companyId/embed-code', () => {
  let sessionCookie: string;
  const companyId = 'embed-scoped-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${companyId}', 'Embed Scoped Co', 'embedscoped@test.com', '#2563eb', 'company-admin');`);
    sessionCookie = await setupAndLogin('embedscoped@test.com', 'EmbedScoped1!');
  });

  it('returns script tag with correct companyId', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/embed-code`, {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { embedCode: string };
    expect(body.embedCode).toContain(companyId);
    expect(body.embedCode).toContain('<script');
    expect(body.embedCode).toContain('roofing-widget.js');
  });

  it('company-admin cannot get embed-code for another company (403)', async () => {
    const res = await app.request('/api/admin/companies/other-company/embed-code', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(403);
  });
});

// ============================================================
// Task 2 (08-02): Pagination for list endpoints + leads endpoint
// ============================================================

describe('GET /api/admin/companies - paginated response', () => {
  let superAdminCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('paginate-super', 'Paginate Super', 'pagsuper@test.com', '#2563eb', 'super-admin');");
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('paginate-co-1', 'Paginate Co 1', 'pagco1@test.com', '#2563eb');");
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('paginate-co-2', 'Paginate Co 2', 'pagco2@test.com', '#2563eb');");
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('paginate-co-3', 'Paginate Co 3', 'pagco3@test.com', '#2563eb');");
    superAdminCookie = await setupAndLogin('pagsuper@test.com', 'PagSuper1!');
  });

  it('returns paginated response with { data, total, page, pageSize }', async () => {
    const res = await app.request('/api/admin/companies', {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number; page: number; pageSize: number };
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('pageSize');
    expect(Array.isArray(body.data)).toBe(true);
    expect(typeof body.total).toBe('number');
  });

  it('GET /api/admin/companies?page=1&pageSize=2 returns 2 companies with correct total', async () => {
    const res = await app.request('/api/admin/companies?page=1&pageSize=2', {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number; page: number; pageSize: number };
    expect(body.data.length).toBe(2);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(2);
    expect(body.total).toBeGreaterThanOrEqual(4); // at least 4 companies seeded
  });
});

describe('GET /api/companies (public) - paginated response', () => {
  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('pub-co-1', 'Public Co 1', 'pubco1@test.com', '#2563eb');");
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('pub-co-2', 'Public Co 2', 'pubco2@test.com', '#2563eb');");
  });

  it('returns paginated response with { data, total, page, pageSize }', async () => {
    const res = await app.request('/api/companies', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number; page: number; pageSize: number };
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('pageSize');
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('pageSize param is respected', async () => {
    const res = await app.request('/api/companies?page=1&pageSize=1', { method: 'GET' }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number; page: number; pageSize: number };
    expect(body.data.length).toBe(1);
    expect(body.pageSize).toBe(1);
  });
});

describe('GET /api/admin/companies/:companyId/leads - paginated response', () => {
  let superAdminCookie: string;
  const companyId = 'leads-paginate-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${companyId}', 'Leads Paginate Co', 'leadspag@test.com', '#2563eb', 'super-admin');`);
    // Create leads table if not exists
    await env.DB.exec("CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL, phone text NOT NULL, consent_given integer NOT NULL, consent_text text NOT NULL, sqft real NOT NULL, pitch text NOT NULL, material text NOT NULL, estimate_low real NOT NULL, estimate_high real NOT NULL, address text, created_at text DEFAULT (datetime('now')));");
    // Seed 5 leads for this company
    for (let i = 1; i <= 5; i++) {
      await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high) VALUES ('lead-${i}', '${companyId}', 'First${i}', 'Last${i}', 'lead${i}@test.com', '555-000${i}', 1, 'I consent', 1500, 'medium', 'architectural', 5000, 7000);`);
    }
    superAdminCookie = await setupAndLogin('leadspag@test.com', 'LeadsPag1!');
  });

  it('returns paginated response with { data, total, page, pageSize }', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number; page: number; pageSize: number };
    expect(body).toHaveProperty('data');
    expect(body).toHaveProperty('total');
    expect(body).toHaveProperty('page');
    expect(body).toHaveProperty('pageSize');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.total).toBe(5);
  });

  it('GET /api/admin/companies/:companyId/leads?page=2&pageSize=2 returns correct offset', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?page=2&pageSize=2`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[]; total: number; page: number; pageSize: number };
    expect(body.data.length).toBe(2);
    expect(body.page).toBe(2);
    expect(body.pageSize).toBe(2);
    expect(body.total).toBe(5);
  });
});

// ============================================================
// Task 1 (09-01): Search/filter, CSV export, and stats endpoints
// ============================================================

describe('GET /api/admin/companies/:companyId/leads - search and date filter', () => {
  let superAdminCookie: string;
  const companyId = 'leads-search-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${companyId}', 'Search Co', 'leadsearch@test.com', '#2563eb', 'super-admin');`);
    await env.DB.exec("CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL, phone text NOT NULL, consent_given integer NOT NULL, consent_text text NOT NULL, sqft real NOT NULL, pitch text NOT NULL, material text NOT NULL, estimate_low real NOT NULL, estimate_high real NOT NULL, address text, created_at text DEFAULT (datetime('now')));");
    // Seed varied leads
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high, created_at) VALUES ('sl-1', '${companyId}', 'John', 'Smith', 'john.smith@example.com', '5550001', 1, 'consent', 1500, 'medium', 'architectural', 5000, 7000, '2026-01-15 10:00:00');`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high, created_at) VALUES ('sl-2', '${companyId}', 'Jane', 'Doe', 'jane.doe@example.com', '5550002', 1, 'consent', 2000, 'steep', '3-tab', 6000, 8000, '2026-02-10 10:00:00');`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high, created_at) VALUES ('sl-3', '${companyId}', 'Alice', 'Johnson', 'alice@gmail.com', '5550003', 1, 'consent', 2500, 'flat', 'standing-seam-metal', 9000, 12000, '2026-03-05 10:00:00');`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high, created_at) VALUES ('sl-4', '${companyId}', 'Bob', 'Smith', 'bob.smith@example.com', '5550004', 1, 'consent', 1800, 'low', 'architectural', 5500, 7500, '2026-03-20 10:00:00');`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high, created_at) VALUES ('sl-5', '${companyId}', 'Charlie', 'Brown', 'charlie@example.com', '5550005', 1, 'consent', 3000, 'medium', 'architectural', 10000, 13000, '2026-03-22 10:00:00');`);
    superAdminCookie = await setupAndLogin('leadsearch@test.com', 'LeadSearch1!');
  });

  it('search=john returns leads matching first name (case-insensitive)', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?search=john`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ firstName: string; lastName: string; email: string }>; total: number };
    // Matches "John" (firstName) and "Alice Johnson" (lastName)
    expect(body.total).toBeGreaterThanOrEqual(2);
    const names = body.data.map((l) => `${l.firstName} ${l.lastName}`);
    expect(names.some((n) => n.includes('John'))).toBe(true);
  });

  it('search=smith returns leads matching last name', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?search=smith`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ lastName: string }>; total: number };
    expect(body.total).toBe(2); // John Smith and Bob Smith
    expect(body.data.every((l) => l.lastName === 'Smith')).toBe(true);
  });

  it('search=gmail returns leads matching email', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?search=gmail`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ email: string }>; total: number };
    expect(body.total).toBe(1);
    expect(body.data[0].email).toBe('alice@gmail.com');
  });

  it('from=2026-02-01 returns only leads on or after that date', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?from=2026-02-01`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { total: number };
    expect(body.total).toBe(4); // Feb 10, Mar 5, Mar 20, Mar 22
  });

  it('to=2026-02-28 returns only leads on or before that date', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?to=2026-02-28`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { total: number };
    expect(body.total).toBe(2); // Jan 15, Feb 10
  });

  it('from+to range filters correctly', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?from=2026-02-01&to=2026-02-28`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { total: number };
    expect(body.total).toBe(1); // Feb 10 only
  });

  it('search+from combo filters correctly', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads?search=smith&from=2026-03-01`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ firstName: string }>; total: number };
    expect(body.total).toBe(1); // Bob Smith (Mar 20) — John Smith is Jan
    expect(body.data[0].firstName).toBe('Bob');
  });

  it('no filters returns all leads (backward compatible)', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { total: number };
    expect(body.total).toBe(5);
  });
});

describe('GET /api/admin/companies/:companyId/leads/csv', () => {
  let superAdminCookie: string;
  const companyId = 'leads-csv-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${companyId}', 'CSV Co', 'leadcsv@test.com', '#2563eb', 'super-admin');`);
    await env.DB.exec("CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL, phone text NOT NULL, consent_given integer NOT NULL, consent_text text NOT NULL, sqft real NOT NULL, pitch text NOT NULL, material text NOT NULL, estimate_low real NOT NULL, estimate_high real NOT NULL, address text, created_at text DEFAULT (datetime('now')));");
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high, address, created_at) VALUES ('csv-1', '${companyId}', 'Alice', 'Walker', 'alice@csv.com', '5550001', 1, 'consent', 1500, 'medium', 'architectural', 5000, 7000, '123 Main St', '2026-01-10 10:00:00');`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high, address, created_at) VALUES ('csv-2', '${companyId}', 'Bob', 'Builder', 'bob@csv.com', '5550002', 1, 'consent', 2000, 'steep', '3-tab', 6000, 8000, NULL, '2026-02-15 10:00:00');`);
    superAdminCookie = await setupAndLogin('leadcsv@test.com', 'LeadCsv1!');
  });

  it('returns 200 with Content-Type: text/csv', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads/csv`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
  });

  it('CSV has correct header row', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads/csv`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    const text = await res.text();
    const firstLine = text.split('\n')[0];
    expect(firstLine).toBe('Name,Email,Phone,Address,Sqft,Pitch,Material,Estimate Low,Estimate High,Date');
  });

  it('CSV contains lead data rows', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads/csv`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    const text = await res.text();
    expect(text).toContain('Alice Walker');
    expect(text).toContain('alice@csv.com');
    expect(text).toContain('Bob Builder');
  });

  it('returns Content-Disposition attachment header', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/leads/csv`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    const disposition = res.headers.get('content-disposition');
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('.csv');
  });

  it('company-admin cannot get CSV for another company (403)', async () => {
    // Create a separate company-admin user
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('csv-other-company', 'CSV Other Co', 'csvother@test.com', '#2563eb', 'company-admin');");
    const otherCookie = await setupAndLogin('csvother@test.com', 'CsvOther1!');
    const res = await app.request(`/api/admin/companies/${companyId}/leads/csv`, {
      method: 'GET',
      headers: { Cookie: `session=${otherCookie}` },
    }, env);
    expect(res.status).toBe(403);
  });
});

// ============================================================
// Task 1 (10-01): Company archive/restore endpoints
// ============================================================

describe('PATCH /api/admin/companies/:companyId/archive and restore', () => {
  let superAdminCookie: string;
  const superAdminId = 'archive-super-admin';
  const archivableId = 'archive-target-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`ALTER TABLE companies ADD COLUMN archived_at text;`).catch(() => {}); // ignore if already exists
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${superAdminId}', 'Archive Super', 'archivesuper@test.com', '#2563eb', 'super-admin');`);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('${archivableId}', 'Archive Target Co', 'archivetarget@test.com', '#2563eb');`);
    superAdminCookie = await setupAndLogin('archivesuper@test.com', 'ArchiveSuper1!');
  });

  it('PATCH /archive returns 200 and { success: true }', async () => {
    const res = await app.request(`http://localhost/api/admin/companies/${archivableId}/archive`, {
      method: 'PATCH',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('PATCH /archive on already-archived company returns 409', async () => {
    // Already archived from previous test
    const res = await app.request(`http://localhost/api/admin/companies/${archivableId}/archive`, {
      method: 'PATCH',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(409);
  });

  it('GET /api/admin/companies excludes archived companies by default', async () => {
    const res = await app.request('/api/admin/companies', {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: string }> };
    const ids = body.data.map((c) => c.id);
    expect(ids).not.toContain(archivableId);
  });

  it('GET /api/admin/companies?includeArchived=true includes archived companies', async () => {
    const res = await app.request('/api/admin/companies?includeArchived=true', {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: string }> };
    const ids = body.data.map((c) => c.id);
    expect(ids).toContain(archivableId);
  });

  it('PATCH /restore returns 200 and { success: true }', async () => {
    const res = await app.request(`http://localhost/api/admin/companies/${archivableId}/restore`, {
      method: 'PATCH',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('PATCH /restore on non-archived company returns 409', async () => {
    // Already restored from previous test
    const res = await app.request(`http://localhost/api/admin/companies/${archivableId}/restore`, {
      method: 'PATCH',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(409);
  });

  it('archived company settings still accessible via GET /settings', async () => {
    // Archive again
    await app.request(`http://localhost/api/admin/companies/${archivableId}/archive`, {
      method: 'PATCH',
      headers: { Cookie: `session=${superAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    const res = await app.request(`/api/admin/companies/${archivableId}/settings`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('Archive Target Co');
  });

  it('company-admin cannot archive a company (403)', async () => {
    // Create a company-admin user
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('archive-co-admin', 'Archive CoAdmin', 'archivecoadmin@test.com', '#2563eb', 'company-admin');");
    const coAdminCookie = await setupAndLogin('archivecoadmin@test.com', 'ArchiveCoAdmin1!');
    const res = await app.request(`http://localhost/api/admin/companies/${archivableId}/archive`, {
      method: 'PATCH',
      headers: { Cookie: `session=${coAdminCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(403);
  });
});

// ============================================================
// Task 2 (10-01): Pricing validation
// ============================================================

describe('PUT /api/admin/companies/:companyId/pricing - validation', () => {
  let sessionCookie: string;
  const companyId = 'pricing-validation-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('${companyId}', 'Pricing Validation Co', 'pricingval@test.com', '#2563eb');`);
    sessionCookie = await setupAndLogin('pricingval@test.com', 'PricingVal1!');
  });

  it('rejects costLow >= costHigh with 400', async () => {
    const overrides = [{ materialKey: 'architectural', costLow: 5, costHigh: 3 }];
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toMatch(/cost_low.*cost_high|less than/i);
  });

  it('rejects negative costLow with 400', async () => {
    const overrides = [{ materialKey: 'architectural', costLow: -1, costHigh: 5 }];
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it('rejects costHigh > 100 with 400', async () => {
    const overrides = [{ materialKey: 'architectural', costLow: 5, costHigh: 1000 }];
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it('rejects negative pitch multiplier with 400', async () => {
    const overrides = [{ materialKey: 'architectural', costLow: 3, costHigh: 5, pitchFlat: -0.5 }];
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it('rejects pitchSteep > 5 with 400', async () => {
    const overrides = [{ materialKey: 'architectural', costLow: 3, costHigh: 5, pitchSteep: 20 }];
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeTruthy();
  });

  it('accepts valid pricing with costLow < costHigh and valid pitch (200)', async () => {
    const overrides = [{ materialKey: 'architectural', costLow: 2, costHigh: 5, pitchFlat: 1.0 }];
    const res = await app.request(`http://localhost/api/admin/companies/${companyId}/pricing`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: { 'Content-Type': 'application/json', Cookie: `session=${sessionCookie}`, Origin: 'http://localhost' },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });
});

describe('GET /api/admin/companies/:companyId/stats', () => {
  let superAdminCookie: string;
  const companyId = 'stats-company';

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec(`INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('${companyId}', 'Stats Co', 'stats@test.com', '#2563eb', 'super-admin');`);
    await env.DB.exec("CREATE TABLE IF NOT EXISTS leads (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, first_name text NOT NULL, last_name text NOT NULL, email text NOT NULL, phone text NOT NULL, consent_given integer NOT NULL, consent_text text NOT NULL, sqft real NOT NULL, pitch text NOT NULL, material text NOT NULL, estimate_low real NOT NULL, estimate_high real NOT NULL, address text, created_at text DEFAULT (datetime('now')));");
    // 3 architectural, 1 3-tab, 1 standing-seam-metal
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high) VALUES ('stat-1', '${companyId}', 'A', 'A', 'a@test.com', '1', 1, 'c', 1000, 'flat', 'architectural', 3000, 4000);`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high) VALUES ('stat-2', '${companyId}', 'B', 'B', 'b@test.com', '2', 1, 'c', 2000, 'medium', 'architectural', 6000, 8000);`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high) VALUES ('stat-3', '${companyId}', 'C', 'C', 'c@test.com', '3', 1, 'c', 3000, 'steep', 'architectural', 9000, 12000);`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high) VALUES ('stat-4', '${companyId}', 'D', 'D', 'd@test.com', '4', 1, 'c', 1500, 'low', '3-tab', 4000, 5500);`);
    await env.DB.exec(`INSERT OR REPLACE INTO leads (id, company_id, first_name, last_name, email, phone, consent_given, consent_text, sqft, pitch, material, estimate_low, estimate_high) VALUES ('stat-5', '${companyId}', 'E', 'E', 'e@test.com', '5', 1, 'c', 2500, 'medium', 'standing-seam-metal', 8000, 11000);`);
    superAdminCookie = await setupAndLogin('stats@test.com', 'StatsPass1!');
  });

  it('returns { totalLeads, totalEstimates, popularMaterial, averageSqft }', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/stats`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { totalLeads: number; totalEstimates: number; popularMaterial: string; averageSqft: number };
    expect(body).toHaveProperty('totalLeads');
    expect(body).toHaveProperty('totalEstimates');
    expect(body).toHaveProperty('popularMaterial');
    expect(body).toHaveProperty('averageSqft');
  });

  it('totalLeads equals 5', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/stats`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    const body = await res.json() as { totalLeads: number; totalEstimates: number };
    expect(body.totalLeads).toBe(5);
    expect(body.totalEstimates).toBe(5);
  });

  it('popularMaterial is architectural (most frequent)', async () => {
    const res = await app.request(`/api/admin/companies/${companyId}/stats`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    const body = await res.json() as { popularMaterial: string };
    expect(body.popularMaterial).toBe('architectural');
  });

  it('averageSqft is rounded to nearest integer (2000)', async () => {
    // avg(1000+2000+3000+1500+2500) = avg(10000) = 2000
    const res = await app.request(`/api/admin/companies/${companyId}/stats`, {
      method: 'GET',
      headers: { Cookie: `session=${superAdminCookie}` },
    }, env);
    const body = await res.json() as { averageSqft: number };
    expect(body.averageSqft).toBe(2000);
  });

  it('returns zeros and null for company with no leads', async () => {
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color, role) VALUES ('empty-stats-company', 'Empty Stats Co', 'emptystats@test.com', '#2563eb', 'super-admin');");
    const emptyCookie = await setupAndLogin('emptystats@test.com', 'EmptyStats1!');
    const res = await app.request(`/api/admin/companies/empty-stats-company/stats`, {
      method: 'GET',
      headers: { Cookie: `session=${emptyCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { totalLeads: number; totalEstimates: number; popularMaterial: null; averageSqft: number };
    expect(body.totalLeads).toBe(0);
    expect(body.totalEstimates).toBe(0);
    expect(body.popularMaterial).toBeNull();
    expect(body.averageSqft).toBe(0);
  });
});
