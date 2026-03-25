import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie';
import type { Bindings } from '../types';
import { createDb } from '../db';
import { validateSession } from '../auth/session';

export type AdminVars = {
  companyId: string;
  role: 'super-admin' | 'company-admin';
  sessionToken: string;
};

export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: AdminVars;
}>(async (c, next) => {
  const token = getCookie(c, 'session');
  if (!token) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const db = createDb(c.env.DB);
  const session = await validateSession(db, token);
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  c.set('companyId', session.companyId);
  c.set('role', session.role as 'super-admin' | 'company-admin');
  c.set('sessionToken', token);
  await next();
});

export const superAdminOnly = createMiddleware<{
  Bindings: Bindings;
  Variables: AdminVars;
}>(async (c, next) => {
  const role = c.get('role');
  if (role !== 'super-admin') {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});

export const companyAccessGuard = createMiddleware<{
  Bindings: Bindings;
  Variables: AdminVars;
}>(async (c, next) => {
  const role = c.get('role');
  if (role === 'super-admin') {
    await next();
    return;
  }
  const sessionCompanyId = c.get('companyId');
  const routeCompanyId = c.req.param('companyId');
  if (routeCompanyId && routeCompanyId !== sessionCompanyId) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  await next();
});
