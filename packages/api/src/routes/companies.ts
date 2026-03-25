import { Hono } from 'hono';
import { eq, count, isNull, and } from 'drizzle-orm';
import { createDb } from '../db';
import { companies } from '../db/schema';
import type { Bindings } from '../types';

const companiesRoute = new Hono<{ Bindings: Bindings }>();

// List all companies (public, paginated)
companiesRoute.get('/', async (c) => {
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(c.req.query('pageSize') || '20', 10)));
  const offset = (page - 1) * pageSize;
  const db = createDb(c.env.DB);
  const [rows, totalResult] = await Promise.all([
    db
      .select({
        id: companies.id,
        name: companies.name,
        slug: companies.slug,
        logoUrl: companies.logoUrl,
        primaryColor: companies.primaryColor,
      })
      .from(companies)
      .where(isNull(companies.archivedAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ count: count() }).from(companies).where(isNull(companies.archivedAt)),
  ]);
  return c.json({ data: rows, total: totalResult[0].count, page, pageSize });
});

// Get company by slug (public)
companiesRoute.get('/by-slug/:slug', async (c) => {
  const slug = c.req.param('slug');
  const db = createDb(c.env.DB);
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      logoUrl: companies.logoUrl,
      primaryColor: companies.primaryColor,
    })
    .from(companies)
    .where(and(eq(companies.slug, slug), isNull(companies.archivedAt)))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'Company not found' }, 404);
  }
  return c.json(rows[0]);
});

export { companiesRoute };
