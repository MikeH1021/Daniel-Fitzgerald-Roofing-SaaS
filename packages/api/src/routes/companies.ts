import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { companies } from '../db/schema';
import type { Bindings } from '../types';

const companiesRoute = new Hono<{ Bindings: Bindings }>();

// List all companies (public)
companiesRoute.get('/', async (c) => {
  const db = createDb(c.env.DB);
  const rows = await db
    .select({
      id: companies.id,
      name: companies.name,
      slug: companies.slug,
      logoUrl: companies.logoUrl,
      primaryColor: companies.primaryColor,
    })
    .from(companies);
  return c.json(rows);
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
    .where(eq(companies.slug, slug))
    .limit(1);

  if (rows.length === 0) {
    return c.json({ error: 'Company not found' }, 404);
  }
  return c.json(rows[0]);
});

export { companiesRoute };
