import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, isNull, sql, and } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import type { Bindings } from '../types';
import { createDb } from '../db';
import { companies, adminSessions, pricingOverrides, leads } from '../db/schema';
import { hashPassword } from '../auth/password';

/**
 * CLI routes — intended for use only by the `roofer` CLI tool running on the
 * same host as the API. Gated by a shared secret in the `X-CLI-Secret` header.
 *
 * These routes skip session auth / CSRF / RBAC entirely — a valid CLI secret
 * grants full super-admin access. Do NOT expose these routes to browsers.
 */

const cli = new Hono<{ Bindings: Bindings }>();

// --- Shared secret gate ---

cli.use('*', async (c, next) => {
  const expected = c.env.CLI_SECRET;
  if (!expected) {
    return c.json({ error: 'CLI not configured (CLI_SECRET missing)' }, 503);
  }
  const provided = c.req.header('X-CLI-Secret');
  if (!provided || provided !== expected) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  await next();
});

// --- Helpers ---

function slugify(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
  return slug || 'company';
}

function randomPassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

async function findCompanyByIdOrSlug(db: ReturnType<typeof createDb>, idOrSlug: string) {
  const rows = await db
    .select()
    .from(companies)
    .where(and(eq(companies.slug, idOrSlug), eq(companies.isOwner, false)))
    .limit(1);
  if (rows.length > 0) return rows[0];
  const byId = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, idOrSlug), eq(companies.isOwner, false)))
    .limit(1);
  return byId[0] ?? null;
}

function publicUrl(c: { env: Bindings; req: { url: string } }, slug: string | null): string | null {
  if (!slug) return null;
  const base = c.env.API_BASE_URL || new URL(c.req.url).origin;
  return `${base}/${slug}`;
}

const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];
const MAX_LOGO_SIZE = 1048576; // 1MB
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
};

// --- Routes ---

const createSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

cli.post('/companies', zValidator('json', createSchema), async (c) => {
  const { name, email, slug: customSlug, primaryColor } = c.req.valid('json');
  const db = createDb(c.env.DB);

  const slug = customSlug || slugify(name);
  const existing = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, slug)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: 'Slug already taken' }, 409);
  }

  const id = nanoid();
  await db.insert(companies).values({
    id,
    name,
    email,
    slug,
    primaryColor: primaryColor ?? '#2563eb',
  });

  return c.json({ id, name, slug, email, url: publicUrl(c, slug) }, 201);
});

cli.get('/companies', async (c) => {
  const includeArchived = c.req.query('includeArchived') === 'true';
  const db = createDb(c.env.DB);
  const select = {
    id: companies.id,
    name: companies.name,
    slug: companies.slug,
    email: companies.email,
    logoUrl: companies.logoUrl,
    primaryColor: companies.primaryColor,
    archivedAt: companies.archivedAt,
    createdAt: companies.createdAt,
  };
  const rows = includeArchived
    ? await db.select(select).from(companies).where(eq(companies.isOwner, false))
    : await db
        .select(select)
        .from(companies)
        .where(and(isNull(companies.archivedAt), eq(companies.isOwner, false)));

  return c.json({
    data: rows.map((r) => ({ ...r, url: publicUrl(c, r.slug) })),
  });
});

cli.get('/companies/:idOrSlug', async (c) => {
  const db = createDb(c.env.DB);
  const company = await findCompanyByIdOrSlug(db, c.req.param('idOrSlug'));
  if (!company) return c.json({ error: 'Company not found' }, 404);
  return c.json({ ...company, url: publicUrl(c, company.slug) });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
  email: z.string().email().optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

cli.patch('/companies/:idOrSlug', zValidator('json', updateSchema), async (c) => {
  const data = c.req.valid('json');
  const db = createDb(c.env.DB);
  const company = await findCompanyByIdOrSlug(db, c.req.param('idOrSlug'));
  if (!company) return c.json({ error: 'Company not found' }, 404);

  const updates: Record<string, string> = {};
  if (data.name) updates.name = data.name;
  if (data.email) updates.email = data.email;
  if (data.primaryColor) updates.primaryColor = data.primaryColor;
  if (data.slug && data.slug !== company.slug) {
    const conflict = await db.select({ id: companies.id }).from(companies).where(eq(companies.slug, data.slug)).limit(1);
    if (conflict.length > 0 && conflict[0].id !== company.id) {
      return c.json({ error: 'Slug already taken' }, 409);
    }
    updates.slug = data.slug;
  }

  if (Object.keys(updates).length > 0) {
    await db.update(companies).set(updates).where(eq(companies.id, company.id));
  }
  const newSlug = updates.slug ?? company.slug;
  return c.json({ success: true, id: company.id, slug: newSlug, url: publicUrl(c, newSlug) });
});

cli.delete('/companies/:idOrSlug', async (c) => {
  const db = createDb(c.env.DB);
  const company = await findCompanyByIdOrSlug(db, c.req.param('idOrSlug'));
  if (!company) return c.json({ error: 'Company not found' }, 404);
  if (company.archivedAt !== null) return c.json({ error: 'Company is already archived' }, 409);
  await db.update(companies).set({ archivedAt: sql`(datetime('now'))` }).where(eq(companies.id, company.id));
  return c.json({ success: true, id: company.id });
});

cli.delete('/companies/:idOrSlug/purge', async (c) => {
  const db = createDb(c.env.DB);
  const force = c.req.query('force') === 'true';
  const company = await findCompanyByIdOrSlug(db, c.req.param('idOrSlug'));
  if (!company) return c.json({ error: 'Company not found' }, 404);
  if (!force && company.archivedAt === null) {
    return c.json(
      { error: 'Refusing to purge non-archived company. Archive it first, or pass ?force=true.' },
      409,
    );
  }

  // Best-effort cleanup of any logo objects under ${companyId}/
  try {
    const listed = await c.env.LOGOS_BUCKET.list({ prefix: `${company.id}/` });
    for (const obj of listed.objects) {
      await c.env.LOGOS_BUCKET.delete(obj.key);
    }
  } catch {
    // ignore — the row will still be removed below
  }

  // Clear FK references before removing the company row.
  await db.delete(adminSessions).where(eq(adminSessions.companyId, company.id));
  await db.delete(pricingOverrides).where(eq(pricingOverrides.companyId, company.id));
  await db.delete(leads).where(eq(leads.companyId, company.id));
  await db.delete(companies).where(eq(companies.id, company.id));
  return c.json({ success: true, id: company.id, slug: company.slug });
});

cli.post('/companies/:idOrSlug/restore', async (c) => {
  const db = createDb(c.env.DB);
  const company = await findCompanyByIdOrSlug(db, c.req.param('idOrSlug'));
  if (!company) return c.json({ error: 'Company not found' }, 404);
  if (company.archivedAt === null) return c.json({ error: 'Company is not archived' }, 409);
  await db.update(companies).set({ archivedAt: null }).where(eq(companies.id, company.id));
  return c.json({ success: true, id: company.id, url: publicUrl(c, company.slug) });
});

cli.post('/companies/:idOrSlug/logo', async (c) => {
  const db = createDb(c.env.DB);
  const company = await findCompanyByIdOrSlug(db, c.req.param('idOrSlug'));
  if (!company) return c.json({ error: 'Company not found' }, 404);

  const formData = await c.req.formData();
  const file = formData.get('logo');
  if (!file || !(file instanceof File)) return c.json({ error: 'No logo file provided' }, 400);
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return c.json({ error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_IMAGE_TYPES.join(', ')}` }, 400);
  }
  if (file.size > MAX_LOGO_SIZE) return c.json({ error: 'File too large (max 1MB)' }, 400);

  const ext = MIME_TO_EXT[file.type] || '.png';
  const key = `${company.id}/logo${ext}`;
  await c.env.LOGOS_BUCKET.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
  const logoUrl = `/api/logos/${company.id}`;
  await db.update(companies).set({ logoUrl }).where(eq(companies.id, company.id));
  return c.json({ success: true, logoUrl });
});

const setPasswordSchema = z.object({
  password: z.string().min(8).optional(),
});

cli.post('/companies/:idOrSlug/set-password', zValidator('json', setPasswordSchema), async (c) => {
  const { password: provided } = c.req.valid('json');
  const db = createDb(c.env.DB);
  const company = await findCompanyByIdOrSlug(db, c.req.param('idOrSlug'));
  if (!company) return c.json({ error: 'Company not found' }, 404);

  const password = provided ?? randomPassword(16);
  const hash = await hashPassword(password);
  await db.update(companies).set({ passwordHash: hash }).where(eq(companies.id, company.id));

  return c.json({
    success: true,
    email: company.email,
    password,
    generated: provided === undefined,
    loginUrl: `${c.env.API_BASE_URL || new URL(c.req.url).origin}/admin`,
  });
});

export { cli };
