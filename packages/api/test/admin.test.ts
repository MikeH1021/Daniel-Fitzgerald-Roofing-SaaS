import { describe, it, expect, beforeAll } from 'vitest';
import { env } from 'cloudflare:test';
import app from '../src/index';

async function seedAdminData(db: D1Database) {
  // D1 exec requires single-line statements
  await db.exec("CREATE TABLE IF NOT EXISTS companies (id text PRIMARY KEY NOT NULL, name text NOT NULL, email text NOT NULL, password_hash text, logo_url text, primary_color text DEFAULT '#2563eb', created_at text DEFAULT (datetime('now')), updated_at text DEFAULT (datetime('now')));");
  await db.exec("CREATE TABLE IF NOT EXISTS admin_sessions (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, expires_at text NOT NULL, created_at text DEFAULT (datetime('now')), FOREIGN KEY (company_id) REFERENCES companies(id));");
  await db.exec("CREATE TABLE IF NOT EXISTS pricing_overrides (id text PRIMARY KEY NOT NULL, company_id text NOT NULL, material_key text NOT NULL, cost_low real, cost_high real, pitch_flat real, pitch_low real, pitch_medium real, pitch_steep real, FOREIGN KEY (company_id) REFERENCES companies(id));");
}

/** Helper to setup a password and login, returning the session cookie */
async function setupAndLogin(email: string, password: string): Promise<string> {
  await app.request('/api/admin/setup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
  }, env);

  const loginRes = await app.request('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    headers: { 'Content-Type': 'application/json' },
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

  it('GET /api/admin/settings returns 401', async () => {
    const res = await app.request('/api/admin/settings', { method: 'GET' }, env);
    expect(res.status).toBe(401);
  });

  it('PATCH /api/admin/settings returns 401', async () => {
    const res = await app.request('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff5500' }),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/pricing returns 401', async () => {
    const res = await app.request('/api/admin/pricing', { method: 'GET' }, env);
    expect(res.status).toBe(401);
  });

  it('PUT /api/admin/pricing returns 401', async () => {
    const res = await app.request('/api/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify([]),
      headers: { 'Content-Type': 'application/json' },
    }, env);
    expect(res.status).toBe(401);
  });

  it('GET /api/admin/embed-code returns 401', async () => {
    const res = await app.request('/api/admin/embed-code', { method: 'GET' }, env);
    expect(res.status).toBe(401);
  });

  it('POST /api/admin/logout returns 401', async () => {
    const res = await app.request('/api/admin/logout', { method: 'POST' }, env);
    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/admin/settings', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('settings-company', 'Settings Co', 'settings@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('settings@test.com', 'SettingsPass1!');
  });

  it('updates primary color with valid hex', async () => {
    const res = await app.request('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff5500' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
      },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('rejects invalid hex color', async () => {
    const res = await app.request('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: 'notacolor' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
      },
    }, env);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/admin/settings - returns updated values', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('settings-company', 'Settings Co', 'settings@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('settings@test.com', 'SettingsPass1!');
    // Apply the PATCH so GET can verify
    await app.request('/api/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ primaryColor: '#ff5500' }),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
      },
    }, env);
  });

  it('returns the updated primary color', async () => {
    const res = await app.request('/api/admin/settings', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string; primaryColor: string };
    expect(body.name).toBe('Settings Co');
    expect(body.primaryColor).toBe('#ff5500');
  });
});

describe('PUT /api/admin/pricing', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('pricing-company', 'Pricing Co', 'pricing@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('pricing@test.com', 'PricingPass1!');
  });

  it('replaces all pricing overrides for the company', async () => {
    const overrides = [
      { materialKey: 'architectural', costLow: 5.0, costHigh: 7.0 },
      { materialKey: '3-tab', costLow: 3.0, costHigh: 4.5, pitchSteep: 1.4 },
    ];
    const res = await app.request('/api/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
      },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; count: number };
    expect(body.success).toBe(true);
    expect(body.count).toBe(2);
  });
});

describe('GET /api/admin/pricing - returns current overrides', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('pricing-company', 'Pricing Co', 'pricing@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('pricing@test.com', 'PricingPass1!');
    // Apply PUT so GET can verify
    const overrides = [
      { materialKey: 'architectural', costLow: 5.0, costHigh: 7.0 },
      { materialKey: '3-tab', costLow: 3.0, costHigh: 4.5, pitchSteep: 1.4 },
    ];
    await app.request('/api/admin/pricing', {
      method: 'PUT',
      body: JSON.stringify(overrides),
      headers: {
        'Content-Type': 'application/json',
        Cookie: `session=${sessionCookie}`,
      },
    }, env);
  });

  it('returns the current overrides', async () => {
    const res = await app.request('/api/admin/pricing', {
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

describe('GET /api/admin/embed-code', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('embed-company', 'Embed Co', 'embed@test.com', '#2563eb');");
    sessionCookie = await setupAndLogin('embed@test.com', 'EmbedPass1!');
  });

  it('returns script tag with correct companyId', async () => {
    const res = await app.request('/api/admin/embed-code', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { embedCode: string };
    expect(body.embedCode).toContain('embed-company');
    expect(body.embedCode).toContain('<script');
    expect(body.embedCode).toContain('roofing-widget.js');
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
    const res = await app.request('/api/admin/logout', {
      method: 'POST',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    const setCookieHeader = res.headers.get('set-cookie') || '';
    expect(setCookieHeader).toContain('session=');
  });
});

describe('POST /api/admin/logo', () => {
  let sessionCookie: string;

  beforeAll(async () => {
    await seedAdminData(env.DB);
    await env.DB.exec("INSERT OR REPLACE INTO companies (id, name, email, primary_color) VALUES ('logo-company', 'Logo Co', 'logo@test.com', '#2563eb');");
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

    const res = await app.request('/api/admin/logo', {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(200);
    const body = await res.json() as { logoUrl: string };
    expect(body.logoUrl).toContain('logo-company');
  });

  it('rejects files over 1MB', async () => {
    const bigData = new Uint8Array(1048577); // 1MB + 1 byte
    const file = new File([bigData], 'big.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('logo', file);

    const res = await app.request('/api/admin/logo', {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('1MB');
  });

  it('rejects non-image file types', async () => {
    const file = new File(['hello'], 'test.txt', { type: 'text/plain' });
    const formData = new FormData();
    formData.append('logo', file);

    const res = await app.request('/api/admin/logo', {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain('image');
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
    await app.request('/api/admin/logo', {
      method: 'POST',
      body: formData,
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
  });

  it('serves uploaded logo with correct content-type', async () => {
    const res = await app.request('/api/logos/logo-serve-company', {
      method: 'GET',
    }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('image/png');
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
    await app.request('/api/admin/logout', {
      method: 'POST',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
  });

  it('returns 401 after logout', async () => {
    const res = await app.request('/api/admin/settings', {
      method: 'GET',
      headers: { Cookie: `session=${sessionCookie}` },
    }, env);
    expect(res.status).toBe(401);
  });
});
