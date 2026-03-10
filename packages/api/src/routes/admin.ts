import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie } from 'hono/cookie';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Bindings } from '../types';
import type { AdminVars } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { createDb } from '../db';
import { companies, pricingOverrides } from '../db/schema';
import { hashPassword, verifyPassword } from '../auth/password';
import { createSession, deleteSession } from '../auth/session';

const admin = new Hono<{ Bindings: Bindings; Variables: AdminVars }>();

// --- Unprotected routes ---

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

admin.post('/setup', zValidator('json', setupSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({ id: companies.id, passwordHash: companies.passwordHash })
    .from(companies)
    .where(eq(companies.email, email))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'Company not found' }, 404);
  }

  if (rows[0].passwordHash) {
    return c.json({ error: 'Password already set' }, 409);
  }

  const hash = await hashPassword(password);
  await db.update(companies).set({ passwordHash: hash }).where(eq(companies.id, rows[0].id));

  return c.json({ success: true });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

admin.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({ id: companies.id, name: companies.name, passwordHash: companies.passwordHash })
    .from(companies)
    .where(eq(companies.email, email))
    .limit(1);

  if (rows.length === 0 || !rows[0].passwordHash) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const valid = await verifyPassword(password, rows[0].passwordHash);
  if (!valid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = await createSession(db, rows[0].id);
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800, // 7 days
  });

  return c.json({ companyId: rows[0].id, name: rows[0].name });
});

// --- Protected routes (auth middleware) ---

admin.use('/settings', authMiddleware);
admin.use('/settings/*', authMiddleware);
admin.use('/pricing', authMiddleware);
admin.use('/pricing/*', authMiddleware);
admin.use('/embed-code', authMiddleware);
admin.use('/logout', authMiddleware);
admin.use('/logo', authMiddleware);

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_SIZE = 1048576; // 1MB
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

admin.post('/logo', async (c) => {
  const companyId = c.get('companyId');
  const formData = await c.req.formData();
  const file = formData.get('logo');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No logo file provided' }, 400);
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return c.json({ error: 'Invalid file type. Must be an image (png, jpeg, webp, svg)' }, 400);
  }

  if (file.size > MAX_LOGO_SIZE) {
    return c.json({ error: 'File too large. Maximum size is 1MB' }, 400);
  }

  const ext = MIME_TO_EXT[file.type] || '.png';
  const key = `${companyId}/logo${ext}`;

  await c.env.LOGOS_BUCKET.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  });

  const logoUrl = `/api/logos/${companyId}`;

  const db = createDb(c.env.DB);
  await db.update(companies).set({ logoUrl }).where(eq(companies.id, companyId));

  return c.json({ logoUrl });
});

admin.get('/settings', async (c) => {
  const companyId = c.get('companyId');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({ name: companies.name, primaryColor: companies.primaryColor, logoUrl: companies.logoUrl })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'Company not found' }, 404);
  }

  return c.json(rows[0]);
});

const settingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
});

admin.patch('/settings', zValidator('json', settingsSchema), async (c) => {
  const data = c.req.valid('json');
  const companyId = c.get('companyId');
  const db = createDb(c.env.DB);

  const updates: Record<string, string> = {};
  if (data.primaryColor) updates.primaryColor = data.primaryColor;

  if (Object.keys(updates).length > 0) {
    await db.update(companies).set(updates).where(eq(companies.id, companyId));
  }

  return c.json({ success: true });
});

admin.get('/pricing', async (c) => {
  const companyId = c.get('companyId');
  const db = createDb(c.env.DB);

  const rows = await db
    .select()
    .from(pricingOverrides)
    .where(eq(pricingOverrides.companyId, companyId));

  return c.json(rows);
});

const pricingItemSchema = z.object({
  materialKey: z.enum(['3-tab', 'architectural', 'standing-seam-metal']),
  costLow: z.number().optional(),
  costHigh: z.number().optional(),
  pitchFlat: z.number().optional(),
  pitchLow: z.number().optional(),
  pitchMedium: z.number().optional(),
  pitchSteep: z.number().optional(),
});

admin.put('/pricing', zValidator('json', z.array(pricingItemSchema)), async (c) => {
  const overrides = c.req.valid('json');
  const companyId = c.get('companyId');
  const db = createDb(c.env.DB);

  // Delete existing overrides for this company
  await db.delete(pricingOverrides).where(eq(pricingOverrides.companyId, companyId));

  // Insert new overrides
  if (overrides.length > 0) {
    await db.insert(pricingOverrides).values(
      overrides.map((o) => ({
        id: nanoid(),
        companyId,
        materialKey: o.materialKey,
        costLow: o.costLow ?? null,
        costHigh: o.costHigh ?? null,
        pitchFlat: o.pitchFlat ?? null,
        pitchLow: o.pitchLow ?? null,
        pitchMedium: o.pitchMedium ?? null,
        pitchSteep: o.pitchSteep ?? null,
      })),
    );
  }

  return c.json({ success: true, count: overrides.length });
});

admin.get('/embed-code', async (c) => {
  const companyId = c.get('companyId');
  const baseUrl = c.env.API_BASE_URL || new URL(c.req.url).origin;
  const embedCode = `<script src="${baseUrl}/widget/roofing-widget.js" data-company-id="${companyId}"></script>`;
  return c.json({ embedCode });
});

admin.post('/logout', async (c) => {
  const token = (await import('hono/cookie')).getCookie(c, 'session');
  if (token) {
    const db = createDb(c.env.DB);
    await deleteSession(db, token);
  }
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ success: true });
});

export { admin };
