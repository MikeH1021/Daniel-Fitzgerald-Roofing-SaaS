import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Bindings } from '../types';
import type { AdminVars } from '../middleware/auth';
import { authMiddleware, superAdminOnly, companyAccessGuard } from '../middleware/auth';
import { csrfMiddleware } from '../middleware/csrf';
import { loginRateLimiter } from '../middleware/rate-limit';
import { createDb } from '../db';
import { companies, pricingOverrides } from '../db/schema';
import { hashPassword, verifyPassword } from '../auth/password';
import { createSession, deleteSession } from '../auth/session';

const admin = new Hono<{ Bindings: Bindings; Variables: AdminVars }>();

// --- Shared schemas ---

const settingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
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

admin.post('/login', loginRateLimiter, zValidator('json', loginSchema), async (c) => {
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
  const isSecure = new URL(c.req.url).protocol === 'https:';
  setCookie(c, 'session', token, {
    httpOnly: true,
    secure: isSecure,
    sameSite: 'Lax',
    path: '/',
    maxAge: 604800, // 7 days
  });

  return c.json({ companyId: rows[0].id, name: rows[0].name });
});

// --- Protected routes (auth + CSRF middleware) ---

admin.use('/settings', authMiddleware);
admin.use('/settings/*', authMiddleware);
admin.use('/pricing', authMiddleware);
admin.use('/pricing/*', authMiddleware);
admin.use('/embed-code', authMiddleware);
admin.use('/logout', authMiddleware);
admin.use('/logo', authMiddleware);
admin.use('/companies', authMiddleware);
admin.use('/companies/*', authMiddleware);
admin.use('/me', authMiddleware);
admin.use('/csrf-token', authMiddleware);

// Apply CSRF to state-changing protected routes
admin.use('/settings', csrfMiddleware);
admin.use('/settings/*', csrfMiddleware);
admin.use('/pricing', csrfMiddleware);
admin.use('/pricing/*', csrfMiddleware);
admin.use('/logout', csrfMiddleware);
admin.use('/logo', csrfMiddleware);
admin.use('/companies', csrfMiddleware);
admin.use('/companies/*', csrfMiddleware);

// --- Session info endpoint ---

admin.get('/me', async (c) => {
  const companyId = c.get('companyId');
  const role = c.get('role');
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ name: companies.name })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  const name = rows.length > 0 ? rows[0].name : '';
  return c.json({ companyId, role, name });
});

// --- CSRF token endpoint ---

admin.get('/csrf-token', async (c) => {
  const sessionToken = c.get('sessionToken');
  const token = sessionToken.slice(0, 16);
  return c.json({ token });
});

// --- Company CRUD (protected + RBAC) ---

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const createCompanySchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
});

// Only super-admin can create or list all companies
admin.post('/companies', superAdminOnly, zValidator('json', createCompanySchema), async (c) => {
  const { name, email, slug: customSlug } = c.req.valid('json');
  const db = createDb(c.env.DB);

  const slug = customSlug || slugify(name);
  const id = nanoid();

  // Check slug uniqueness
  const existing = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: 'Slug already taken' }, 409);
  }

  await db.insert(companies).values({ id, name, email, slug, primaryColor: '#2563eb' });
  return c.json({ id, name, slug }, 201);
});

admin.get('/companies', superAdminOnly, async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      email: companies.email,
      logoUrl: companies.logoUrl,
      primaryColor: companies.primaryColor,
    })
    .from(companies);
  return c.json(rows);
});

const updateCompanySchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
});

admin.patch('/companies/:companyId', companyAccessGuard, zValidator('json', updateCompanySchema), async (c) => {
  const companyId = c.req.param('companyId');
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);

  const updates: Record<string, string> = {};
  if (data.name) updates.name = data.name;
  if (data.slug) {
    const existing = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, data.slug)).limit(1);
    if (existing.length > 0 && existing[0].id !== companyId) {
      return c.json({ error: 'Slug already taken' }, 409);
    }
    updates.slug = data.slug;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(companies).set(updates).where(eq(companies.id, companyId));
  }
  return c.json({ success: true });
});

// Company-scoped settings (protected + access guard)
admin.get('/companies/:companyId/settings', companyAccessGuard, async (c) => {
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);
  const rows = await db
    .select({ name: companies.name, primaryColor: companies.primaryColor, logoUrl: companies.logoUrl, slug: companies.slug })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (rows.length === 0) return c.json({ error: 'Company not found' }, 404);
  return c.json(rows[0]);
});

admin.patch('/companies/:companyId/settings', companyAccessGuard, zValidator('json', settingsSchema), async (c) => {
  const data = c.req.valid('json');
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);
  const updates: Record<string, string> = {};
  if (data.primaryColor) updates.primaryColor = data.primaryColor;
  if (Object.keys(updates).length > 0) {
    await db.update(companies).set(updates).where(eq(companies.id, companyId));
  }
  return c.json({ success: true });
});

admin.get('/companies/:companyId/pricing', companyAccessGuard, async (c) => {
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);
  const rows = await db.select().from(pricingOverrides).where(eq(pricingOverrides.companyId, companyId));
  return c.json(rows);
});

admin.put('/companies/:companyId/pricing', companyAccessGuard, zValidator('json', z.array(pricingItemSchema)), async (c) => {
  const overrides = c.req.valid('json');
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);
  await db.delete(pricingOverrides).where(eq(pricingOverrides.companyId, companyId));
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

admin.post('/companies/:companyId/logo', companyAccessGuard, async (c) => {
  const companyId = c.req.param('companyId');
  const formData = await c.req.formData();
  const file = formData.get('logo');
  if (!file || !(file instanceof File)) return c.json({ error: 'No logo file provided' }, 400);
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return c.json({ error: 'Invalid file type' }, 400);
  if (file.size > MAX_LOGO_SIZE) return c.json({ error: 'File too large' }, 400);
  const ext = MIME_TO_EXT[file.type] || '.png';
  const key = `${companyId}/logo${ext}`;
  await c.env.LOGOS_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const logoUrl = `/api/logos/${companyId}`;
  const db = createDb(c.env.DB);
  await db.update(companies).set({ logoUrl }).where(eq(companies.id, companyId));
  return c.json({ logoUrl });
});

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_SIZE = 1048576; // 1MB
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

// --- Legacy session-scoped routes (kept for backward compatibility) ---

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
  const token = getCookie(c, 'session');
  if (token) {
    const db = createDb(c.env.DB);
    await deleteSession(db, token);
  }
  deleteCookie(c, 'session', { path: '/' });
  return c.json({ success: true });
});

export { admin };
