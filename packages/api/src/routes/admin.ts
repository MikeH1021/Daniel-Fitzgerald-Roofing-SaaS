import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { setCookie, deleteCookie, getCookie } from 'hono/cookie';
import { z } from 'zod';
import { eq, count, desc, like, or, and, gte, lte, sql, avg, isNull, isNotNull } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Bindings } from '../types';
import type { AdminVars } from '../middleware/auth';
import { authMiddleware, superAdminOnly, companyAccessGuard } from '../middleware/auth';
import { csrfMiddleware } from '../middleware/csrf';
import { loginRateLimiter } from '../middleware/rate-limit';
import { createDb } from '../db';
import { companies, pricingOverrides, leads } from '../db/schema';
import { hashPassword, verifyPassword } from '../auth/password';
import { createSession, deleteSession } from '../auth/session';

const admin = new Hono<{ Bindings: Bindings; Variables: AdminVars }>();

// --- Shared schemas ---

const settingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
});

const pricingItemSchema = z.object({
  materialKey: z.enum(['3-tab', 'architectural', 'standing-seam-metal']),
  costLow: z.number().nonnegative('Cost must be non-negative').max(100, 'Cost per sqft must be under $100').optional(),
  costHigh: z.number().nonnegative('Cost must be non-negative').max(100, 'Cost per sqft must be under $100').optional(),
  pitchFlat: z.number().nonnegative('Pitch multiplier must be non-negative').max(5, 'Pitch multiplier must be under 5.0').optional(),
  pitchLow: z.number().nonnegative('Pitch multiplier must be non-negative').max(5, 'Pitch multiplier must be under 5.0').optional(),
  pitchMedium: z.number().nonnegative('Pitch multiplier must be non-negative').max(5, 'Pitch multiplier must be under 5.0').optional(),
  pitchSteep: z.number().nonnegative('Pitch multiplier must be non-negative').max(5, 'Pitch multiplier must be under 5.0').optional(),
}).refine(
  (data) => {
    if (data.costLow !== undefined && data.costHigh !== undefined) {
      return data.costLow < data.costHigh;
    }
    return true;
  },
  { message: 'cost_low must be less than cost_high' }
);

// --- Unprotected routes ---

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

admin.post('/setup', zValidator('json', setupSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = createDb(c.env.DB);

  const rows = await db
    .select({ id: companies.id, passwordHash: companies.passwordHash, role: companies.role })
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

  // Bootstrap: promote to super-admin only if this is the sole company with no existing passwords
  const [existingAdmins, totalCompanies] = await Promise.all([
    db.select({ id: companies.id }).from(companies).where(isNotNull(companies.passwordHash)).limit(1),
    db.select({ count: count() }).from(companies),
  ]);
  const updates: Record<string, unknown> = { passwordHash: hash };
  if (existingAdmins.length === 0 && totalCompanies[0].count === 1) {
    updates.role = 'super-admin';
  }

  await db.update(companies).set(updates).where(eq(companies.id, rows[0].id));

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
    .select({ id: companies.id, name: companies.name, role: companies.role, passwordHash: companies.passwordHash })
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

  return c.json({ companyId: rows[0].id, name: rows[0].name, role: rows[0].role });
});

// --- Protected routes (auth + CSRF middleware) ---

admin.use('/logout', authMiddleware);
admin.use('/companies', authMiddleware);
admin.use('/companies/*', authMiddleware);
admin.use('/me', authMiddleware);
admin.use('/csrf-token', authMiddleware);

// Apply CSRF to state-changing protected routes
admin.use('/logout', csrfMiddleware);
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
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  return slug || 'company';
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
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;
  const includeArchived = c.req.query('includeArchived') === 'true';
  const db = createDb(c.env.DB);

  const baseSelect = {
    id: companies.id,
    name: companies.name,
    slug: companies.slug,
    email: companies.email,
    logoUrl: companies.logoUrl,
    primaryColor: companies.primaryColor,
    archivedAt: companies.archivedAt,
  };

  const [rows, totalResult] = await Promise.all([
    includeArchived
      ? db.select(baseSelect).from(companies).limit(pageSize).offset(offset)
      : db.select(baseSelect).from(companies).where(isNull(companies.archivedAt)).limit(pageSize).offset(offset),
    includeArchived
      ? db.select({ count: count() }).from(companies)
      : db.select({ count: count() }).from(companies).where(isNull(companies.archivedAt)),
  ]);
  return c.json({ data: rows, total: totalResult[0].count, page, pageSize });
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

// Archive/restore endpoints (super-admin only)
admin.patch('/companies/:companyId/archive', superAdminOnly, async (c) => {
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);
  const rows = await db.select({ archivedAt: companies.archivedAt }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (rows.length === 0) return c.json({ error: 'Company not found' }, 404);
  if (rows[0].archivedAt !== null) return c.json({ error: 'Company is already archived' }, 409);
  await db.update(companies).set({ archivedAt: sql`(datetime('now'))` }).where(eq(companies.id, companyId));
  return c.json({ success: true });
});

admin.patch('/companies/:companyId/restore', superAdminOnly, async (c) => {
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);
  const rows = await db.select({ archivedAt: companies.archivedAt }).from(companies).where(eq(companies.id, companyId)).limit(1);
  if (rows.length === 0) return c.json({ error: 'Company not found' }, 404);
  if (rows[0].archivedAt === null) return c.json({ error: 'Company is not archived' }, 409);
  await db.update(companies).set({ archivedAt: null }).where(eq(companies.id, companyId));
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

admin.put('/companies/:companyId/pricing', companyAccessGuard, zValidator('json', z.array(pricingItemSchema), (result, c) => {
  if (!result.success) {
    const firstError = result.error.errors[0];
    return c.json({ error: firstError.message, details: result.error.errors.map((e) => ({ field: e.path.join('.'), message: e.message })) }, 400);
  }
}), async (c) => {
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

// --- Leads list endpoint (paginated, with search/filter) ---

function buildLeadsWhereConditions(companyId: string, search?: string, from?: string, to?: string) {
  const conditions = [eq(leads.companyId, companyId)];

  if (search) {
    const pattern = `%${search}%`;
    conditions.push(
      or(
        like(leads.firstName, pattern),
        like(leads.lastName, pattern),
        like(leads.email, pattern),
      )!
    );
  }

  if (from) {
    conditions.push(gte(leads.createdAt, from));
  }

  if (to) {
    conditions.push(lte(leads.createdAt, `${to}T23:59:59`));
  }

  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

admin.get('/companies/:companyId/leads/csv', companyAccessGuard, async (c) => {
  const companyId = c.req.param('companyId');
  const search = c.req.query('search');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const db = createDb(c.env.DB);
  const where = buildLeadsWhereConditions(companyId, search, from, to);

  const rows = await db
    .select()
    .from(leads)
    .where(where)
    .orderBy(desc(leads.createdAt));

  function escapeCSV(value: string | number | null | undefined): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const header = 'Name,Email,Phone,Address,Sqft,Pitch,Material,Estimate Low,Estimate High,Date';
  const dataRows = rows.map((lead) =>
    [
      escapeCSV(`${lead.firstName} ${lead.lastName}`),
      escapeCSV(lead.email),
      escapeCSV(lead.phone),
      escapeCSV(lead.address),
      escapeCSV(lead.sqft),
      escapeCSV(lead.pitch),
      escapeCSV(lead.material),
      escapeCSV(lead.estimateLow),
      escapeCSV(lead.estimateHigh),
      escapeCSV(lead.createdAt),
    ].join(',')
  );

  const csv = [header, ...dataRows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="leads-${companyId}.csv"`,
    },
  });
});

admin.get('/companies/:companyId/leads', companyAccessGuard, async (c) => {
  const companyId = c.req.param('companyId');
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;
  const search = c.req.query('search');
  const from = c.req.query('from');
  const to = c.req.query('to');
  const db = createDb(c.env.DB);
  const where = buildLeadsWhereConditions(companyId, search, from, to);

  const [rows, totalResult] = await Promise.all([
    db
      .select()
      .from(leads)
      .where(where)
      .orderBy(desc(leads.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(leads).where(where),
  ]);
  return c.json({ data: rows, total: totalResult[0].count, page, pageSize });
});

// --- Stats endpoint ---

admin.get('/companies/:companyId/stats', companyAccessGuard, async (c) => {
  const companyId = c.req.param('companyId');
  const db = createDb(c.env.DB);

  const [countResult, avgResult, materialResult] = await Promise.all([
    db.select({ count: count() }).from(leads).where(eq(leads.companyId, companyId)),
    db.select({ avg: avg(leads.sqft) }).from(leads).where(eq(leads.companyId, companyId)),
    db
      .select({ material: leads.material, cnt: count() })
      .from(leads)
      .where(eq(leads.companyId, companyId))
      .groupBy(leads.material)
      .orderBy(desc(count()))
      .limit(1),
  ]);

  const totalLeads = countResult[0].count;
  const rawAvg = avgResult[0].avg;
  const averageSqft = rawAvg !== null ? Math.round(Number(rawAvg)) : 0;
  const popularMaterial = materialResult.length > 0 ? materialResult[0].material : null;

  return c.json({
    totalLeads,
    totalEstimates: totalLeads,
    popularMaterial,
    averageSqft,
  });
});

// --- Company-scoped embed-code endpoint ---

admin.get('/companies/:companyId/embed-code', companyAccessGuard, async (c) => {
  const companyId = c.req.param('companyId');
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
