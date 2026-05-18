import { Hono } from 'hono';
import { eq, and, isNull } from 'drizzle-orm';
import { createDb } from '../db';
import { companies } from '../db/schema';
import type { Bindings } from '../types';

const config = new Hono<{ Bindings: Bindings }>();

config.get('/:companyId', async (c) => {
  const companyId = c.req.param('companyId');

  // Demo mode — return default config without DB lookup
  if (companyId === 'demo') {
    return c.json({
      id: 'demo',
      name: 'Demo Roofing Co',
      logoUrl: null,
      primaryColor: '#d97706',
    });
  }

  const db = createDb(c.env.DB);
  const results = await db
    .select()
    .from(companies)
    .where(and(eq(companies.id, companyId), isNull(companies.archivedAt), eq(companies.isOwner, false)));

  if (results.length === 0) {
    return c.json({ error: 'Company not found' }, 404);
  }

  const company = results[0];
  return c.json({
    id: company.id,
    name: company.name,
    logoUrl: company.logoUrl,
    primaryColor: company.primaryColor,
  });
});

export { config };
