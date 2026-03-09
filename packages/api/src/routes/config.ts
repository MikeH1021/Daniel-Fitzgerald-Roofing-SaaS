import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { createDb } from '../db';
import { companies } from '../db/schema';
import type { Bindings } from '../types';

const config = new Hono<{ Bindings: Bindings }>();

config.get('/:companyId', async (c) => {
  const companyId = c.req.param('companyId');

  const db = createDb(c.env.DB);
  const results = await db
    .select()
    .from(companies)
    .where(eq(companies.id, companyId));

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
