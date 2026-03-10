import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { Bindings } from '../types';
import { createDb } from '../db';
import { validateSession } from '../auth/session';

export type AdminVars = { companyId: string };

export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: AdminVars;
}>(async (c, next) => {
  const token = getCookie(c, 'session');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = createDb(c.env.DB);
  const companyId = await validateSession(db, token);
  if (!companyId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('companyId', companyId);
  await next();
});
